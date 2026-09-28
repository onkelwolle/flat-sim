import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlanStore, type Plan } from '../plan/planStore'
import {
  createProjectPersistence,
  type PersistentStorage,
  type ProjectNotice,
} from './projectPersistence'
import {
  CorruptProjectError,
  type ProjectRepository,
  type SavedProject,
} from './projectRepository'

const viewport = { width: 1000, height: 800 }

/** Stands in for a decoded image; its size is read from the blob's text. */
const decodeImage = async (blob: Blob) => {
  const text = await blob.text()
  if (text === 'broken') throw new Error('not an image')
  const [width, height] = text.split('x').map(Number)
  return { width, height, close() {} } as ImageBitmap
}

const plan = (name: string): Plan => ({
  name,
  image: { width: 2000, height: 1000, close() {} } as ImageBitmap,
  width: 2000,
  height: 1000,
  source: new Blob(['2000x1000']),
})

const calibration = {
  start: { x: 100, y: 100 },
  end: { x: 300, y: 100 },
  lengthCm: 400,
  scale: { pixelsPerMetre: 50 },
}

const saved: SavedProject = {
  plan: { name: 'flat.png', image: new Blob(['2000x1000']) },
  calibration,
  furniture: [
    {
      id: 'item-4',
      name: 'Sofa',
      widthCm: 200,
      depthCm: 90,
      position: { x: 400, y: 300 },
      rotationDeg: 90,
    },
  ],
}

/** An in-memory repository that records what it is asked to do. */
class FakeRepository implements ProjectRepository {
  saves: SavedProject[] = []
  clears = 0
  failLoad: Error | null = null
  failWrites = false
  /** While set, loading waits until `finishLoad` is called. */
  loadHangs = false
  finishLoad = () => {}
  project: SavedProject | null
  constructor(project: SavedProject | null = null) {
    this.project = project
  }
  async load() {
    if (this.loadHangs) {
      await new Promise<void>((resolve) => (this.finishLoad = resolve))
    }
    if (this.failLoad) throw this.failLoad
    return this.project
  }
  async save(project: SavedProject) {
    if (this.failWrites) throw new Error('QuotaExceededError')
    this.saves.push(project)
    this.project = project
  }
  async clear() {
    if (this.failWrites) throw new Error('QuotaExceededError')
    this.clears++
    this.project = null
  }
}

/** The browser's storage manager, granting or denying persistent storage. */
class FakeStorage {
  persistRequests = 0
  alreadyPersisted = false
  grants = true
  async persisted() {
    return this.alreadyPersisted
  }
  async persist() {
    this.persistRequests++
    return this.grants
  }
}

const setUp = (
  repository = new FakeRepository(),
  /** null stands for a browser without a storage manager. */
  storage: PersistentStorage | null = new FakeStorage(),
) => {
  const store = createPlanStore()
  const notices: (ProjectNotice | null)[] = []
  const persistence = createProjectPersistence({
    store,
    repository,
    storage: storage ?? undefined,
    decodeImage,
    onNotice: (notice) => notices.push(notice),
  })
  const lastNotice = () => notices.at(-1) ?? null
  return { store, repository, persistence, notices, lastNotice }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('restoring the project', () => {
  it('restores the saved plan, calibration and furniture', async () => {
    const { store, persistence } = setUp(new FakeRepository(saved))

    await persistence.restore(viewport)

    const state = store.getState()
    expect(state.plan?.name).toBe('flat.png')
    expect(state.plan).toMatchObject({ width: 2000, height: 1000 })
    expect(state.calibration).toEqual(calibration)
    expect(state.furniture).toEqual(saved.furniture)
    expect(state.view).toEqual({ scale: 0.5, x: 0, y: 150 })
  })
})

describe('a restore that takes too long', () => {
  const hanging = () => {
    const repository = new FakeRepository(saved)
    repository.loadHangs = true
    return setUp(repository)
  }

  it('starts empty with a notice after 5 s, and saves changes from then on', async () => {
    const { store, repository, persistence, lastNotice } = hanging()
    let restored = false
    void persistence.restore(viewport).then(() => (restored = true))

    await vi.advanceTimersByTimeAsync(4999)
    expect(restored).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(restored).toBe(true)
    expect(store.getState().plan).toBeNull()
    expect(lastNotice()).toBe('storage-unavailable')

    store.getState().offerPlan(plan('flat.png'), viewport)
    await vi.advanceTimersByTimeAsync(500)
    expect(repository.saves.at(-1)?.plan?.name).toBe('flat.png')
  })

  it('shows the saved project if it arrives late while the project is still empty', async () => {
    const { store, repository, persistence, lastNotice } = hanging()
    const restoring = persistence.restore(viewport)
    await vi.advanceTimersByTimeAsync(5000)
    await restoring

    repository.finishLoad()
    await vi.advanceTimersByTimeAsync(2000)

    expect(store.getState().plan?.name).toBe('flat.png')
    expect(store.getState().furniture).toEqual(saved.furniture)
    expect(lastNotice()).toBeNull()
    expect(repository.saves).toEqual([])
  })

  it('keeps changes made before the saved project arrives late', async () => {
    const { store, repository, persistence } = hanging()
    const restoring = persistence.restore(viewport)
    await vi.advanceTimersByTimeAsync(5000)
    await restoring
    store.getState().offerPlan(plan('new.png'), viewport)

    repository.finishLoad()
    await vi.advanceTimersByTimeAsync(2000)

    expect(store.getState().plan?.name).toBe('new.png')
    expect(store.getState().furniture).toEqual([])
    expect(repository.project?.plan?.name).toBe('new.png')
  })

  it('does not restore late once stopped', async () => {
    const { store, repository, persistence } = hanging()
    const restoring = persistence.restore(viewport)
    await vi.advanceTimersByTimeAsync(5000)
    await restoring

    persistence.stop()
    repository.finishLoad()
    await vi.advanceTimersByTimeAsync(2000)

    expect(store.getState().plan).toBeNull()
  })
})

describe('autosave', () => {
  it('saves the plan, calibration and furniture once changes pause for 500 ms', async () => {
    const { store, repository, persistence } = setUp()
    await persistence.restore(viewport)
    const flat = plan('flat.png')

    store.getState().offerPlan(flat, viewport)
    await vi.advanceTimersByTimeAsync(300)
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)
    await vi.advanceTimersByTimeAsync(499)
    expect(repository.saves).toEqual([])

    await vi.advanceTimersByTimeAsync(1)
    expect(repository.saves).toEqual([
      {
        plan: { name: 'flat.png', image: flat.source },
        calibration,
        furniture: [],
      },
    ])
  })

  it('does not save the restored project back, nor the view, selection or tools', async () => {
    const { store, repository, persistence } = setUp(new FakeRepository(saved))
    await persistence.restore(viewport)

    store.getState().zoomAt({ x: 10, y: 10 }, 2, viewport)
    store.getState().panBy({ x: 30, y: 0 })
    store.getState().selectFurniture('item-4')
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 0, y: 0 })
    store.getState().startCalibration()
    store.getState().offerPlan(plan('other.png'), viewport)
    await vi.advanceTimersByTimeAsync(2000)

    expect(repository.saves).toEqual([])
  })

  it('saves moved, rotated, resized, added and deleted furniture', async () => {
    const { store, repository, persistence } = setUp(new FakeRepository(saved))
    await persistence.restore(viewport)
    const lastSavedIds = () =>
      repository.saves.at(-1)?.furniture.map((f) => f.id)

    store.getState().moveFurniture('item-4', { x: 1, y: 2 })
    store.getState().rotateFurniture('item-4', 30)
    store.getState().resizeFurniture('item-4', 100, 50)
    await vi.advanceTimersByTimeAsync(500)
    expect(repository.saves.at(-1)?.furniture).toEqual([
      {
        ...saved.furniture[0],
        position: { x: 1, y: 2 },
        rotationDeg: 30,
        widthCm: 100,
        depthCm: 50,
      },
    ])

    store
      .getState()
      .addFurniture({ name: 'Bed', widthCm: 1, depthCm: 1 }, viewport)
    await vi.advanceTimersByTimeAsync(500)
    expect(lastSavedIds()).toEqual(['item-4', 'item-5'])

    store.getState().deleteSelectedFurniture()
    await vi.advanceTimersByTimeAsync(500)
    expect(lastSavedIds()).toEqual(['item-4'])
    expect(repository.saves).toHaveLength(3)
  })

  it('saves the project as undo and redo leave it', async () => {
    const { store, repository, persistence } = setUp(new FakeRepository(saved))
    await persistence.restore(viewport)
    store.getState().moveFurniture('item-4', { x: 1, y: 2 })
    await vi.advanceTimersByTimeAsync(500)

    store.getState().undo(viewport)
    await vi.advanceTimersByTimeAsync(500)
    expect(repository.saves.at(-1)?.furniture).toEqual(saved.furniture)

    store.getState().redo(viewport)
    await vi.advanceTimersByTimeAsync(500)
    expect(repository.saves.at(-1)?.furniture[0]?.position).toEqual({
      x: 1,
      y: 2,
    })
  })
})

describe('undo after restoring', () => {
  it('has nothing to undo from before a saved project arrives late', async () => {
    const repository = new FakeRepository(saved)
    repository.loadHangs = true
    const { store, persistence } = setUp(repository)
    const restoring = persistence.restore(viewport)
    await vi.advanceTimersByTimeAsync(5000)
    await restoring

    repository.finishLoad()
    await vi.advanceTimersByTimeAsync(2000)

    expect(store.getState().plan?.name).toBe('flat.png')
    expect(store.getState().nextUndo).toBeNull()
  })
})

describe('a new project', () => {
  it('clears the store and the saved project, dropping any unsaved change', async () => {
    const { store, repository, persistence } = setUp(new FakeRepository(saved))
    await persistence.restore(viewport)
    store.getState().moveFurniture('item-4', { x: 1, y: 2 })

    await persistence.newProject()
    await vi.advanceTimersByTimeAsync(2000)

    expect(store.getState().plan).toBeNull()
    expect(store.getState().furniture).toEqual([])
    expect(repository.project).toBeNull()
    expect(repository.clears).toBe(1)
    expect(repository.saves).toEqual([])
  })

  it('saves the next plan opened after it', async () => {
    const { store, repository, persistence } = setUp(new FakeRepository(saved))
    await persistence.restore(viewport)
    await persistence.newProject()

    store.getState().offerPlan(plan('next.png'), viewport)
    await vi.advanceTimersByTimeAsync(500)

    expect(repository.project?.plan?.name).toBe('next.png')
  })

  it('shows a notice when the saved project cannot be cleared', async () => {
    const { store, repository, persistence, lastNotice } = setUp(
      new FakeRepository(saved),
    )
    await persistence.restore(viewport)
    repository.failWrites = true

    await persistence.newProject()

    expect(store.getState().plan).toBeNull()
    expect(lastNotice()).toBe('save-failed')
  })
})

describe('stopping', () => {
  it('saves nothing more once stopped', async () => {
    const { store, repository, persistence } = setUp()
    await persistence.restore(viewport)
    store.getState().offerPlan(plan('flat.png'), viewport)

    persistence.stop()
    store.getState().offerPlan(plan('other.png'), viewport)
    store.getState().confirmReplace(viewport)
    await vi.advanceTimersByTimeAsync(2000)

    expect(repository.saves).toEqual([])
  })

  it('neither restores nor saves if stopped before the restore finishes', async () => {
    const { store, repository, persistence } = setUp(new FakeRepository(saved))

    const restoring = persistence.restore(viewport)
    persistence.stop()
    await restoring
    expect(store.getState().plan).toBeNull()

    store.getState().offerPlan(plan('flat.png'), viewport)
    await vi.advanceTimersByTimeAsync(2000)
    expect(repository.saves).toEqual([])
  })
})

describe('storage failures', () => {
  it('starts empty with a notice when storage cannot be opened', async () => {
    const repository = new FakeRepository(saved)
    repository.failLoad = new Error('IndexedDB is not available')
    const { store, persistence, lastNotice } = setUp(repository)

    await persistence.restore(viewport)

    expect(store.getState().plan).toBeNull()
    expect(lastNotice()).toBe('storage-unavailable')
  })

  it('keeps the one notice while storage stays unavailable', async () => {
    const repository = new FakeRepository()
    repository.failLoad = new Error('IndexedDB is not available')
    repository.failWrites = true
    const { store, persistence, notices } = setUp(repository)
    await persistence.restore(viewport)

    store.getState().offerPlan(plan('flat.png'), viewport)
    await vi.advanceTimersByTimeAsync(500)

    expect(notices).toEqual(['storage-unavailable'])
  })

  it('starts empty with a notice when the saved project cannot be read', async () => {
    const repository = new FakeRepository(saved)
    repository.failLoad = new CorruptProjectError()
    const { store, persistence, lastNotice } = setUp(repository)

    await persistence.restore(viewport)

    expect(store.getState().plan).toBeNull()
    expect(lastNotice()).toBe('restore-failed')
  })

  it('starts empty with a notice when the saved plan image cannot be decoded', async () => {
    const { store, persistence, lastNotice } = setUp(
      new FakeRepository({
        ...saved,
        plan: { name: 'flat.png', image: new Blob(['broken']) },
      }),
    )

    await persistence.restore(viewport)

    expect(store.getState().plan).toBeNull()
    expect(store.getState().furniture).toEqual([])
    expect(lastNotice()).toBe('restore-failed')
  })

  it('keeps working with a notice while saving fails, and drops it once a save succeeds', async () => {
    const { store, repository, persistence, lastNotice } = setUp()
    await persistence.restore(viewport)
    repository.failWrites = true

    store.getState().offerPlan(plan('flat.png'), viewport)
    await vi.advanceTimersByTimeAsync(500)
    expect(lastNotice()).toBe('save-failed')
    expect(store.getState().plan?.name).toBe('flat.png')

    repository.failWrites = false
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)
    await vi.advanceTimersByTimeAsync(500)
    expect(lastNotice()).toBeNull()
    expect(repository.project?.plan?.name).toBe('flat.png')
  })
})

const calibrate = (store: ReturnType<typeof createPlanStore>) => {
  store.getState().startCalibration()
  store.getState().placeCalibrationPoint({ x: 100, y: 100 })
  store.getState().placeCalibrationPoint({ x: 300, y: 100 })
  store.getState().finishCalibration(400)
}

describe('asking the browser to keep the project', () => {
  it('asks for persistent storage on the first save, and only once', async () => {
    const storage = new FakeStorage()
    const { store, repository, persistence } = setUp(
      new FakeRepository(),
      storage,
    )
    await persistence.restore(viewport)
    expect(storage.persistRequests).toBe(0)

    store.getState().offerPlan(plan('flat.png'), viewport)
    await vi.advanceTimersByTimeAsync(500)
    expect(storage.persistRequests).toBe(1)

    calibrate(store)
    await vi.advanceTimersByTimeAsync(500)
    expect(repository.saves).toHaveLength(2)
    expect(storage.persistRequests).toBe(1)
  })

  it('does not ask when the browser already keeps it', async () => {
    const storage = new FakeStorage()
    storage.alreadyPersisted = true
    const { store, repository, persistence } = setUp(
      new FakeRepository(),
      storage,
    )
    await persistence.restore(viewport)

    store.getState().offerPlan(plan('flat.png'), viewport)
    await vi.advanceTimersByTimeAsync(500)
    expect(repository.saves).toHaveLength(1)
    expect(storage.persistRequests).toBe(0)
  })

  it.each([
    ['the browser has no storage manager', null],
    ['the browser cannot persist storage', {}],
    [
      'the browser denies it',
      { persisted: async () => false, persist: async () => false },
    ],
    [
      'checking fails',
      {
        persisted: () => Promise.reject(new Error('SecurityError')),
        persist: async () => true,
      },
    ],
    [
      'asking throws',
      {
        persisted: async () => false,
        persist: () => {
          throw new Error('SecurityError')
        },
      },
    ],
  ])('keeps saving without a notice when %s', async (_, storage) => {
    const { store, repository, persistence, notices } = setUp(
      new FakeRepository(),
      storage,
    )
    await persistence.restore(viewport)

    store.getState().offerPlan(plan('flat.png'), viewport)
    await vi.advanceTimersByTimeAsync(500)
    calibrate(store)
    await vi.advanceTimersByTimeAsync(500)

    expect(repository.saves).toHaveLength(2)
    expect(notices).toEqual([])
  })
})
