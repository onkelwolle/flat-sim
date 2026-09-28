import type { StoreApi } from 'zustand/vanilla'
import type { PlanState, Project } from '../plan/planStore'
import type { Size } from '../useViewportSize'
import {
  CorruptProjectError,
  type ProjectRepository,
  type SavedProject,
} from './projectRepository'

/** Something about storage the user should know; the app keeps working. */
export type ProjectNotice =
  'storage-unavailable' | 'restore-failed' | 'save-failed'

/** How long changes must pause before they are saved. */
export const SAVE_DELAY_MS = 500

/** How long restoring may take before the app starts empty instead. */
export const RESTORE_TIMEOUT_MS = 5000

const TIMED_OUT = Symbol('timed out')

type Options = {
  store: StoreApi<PlanState>
  repository: ProjectRepository
  /** Decode a saved plan image. */
  decodeImage: (image: Blob) => Promise<ImageBitmap>
  /** Called with a notice to show, or null once there is none. */
  onNotice: (notice: ProjectNotice | null) => void
}

// Each part is replaced on change, never mutated, so comparing references
// tells whether the project changed
const persisted = ({ plan, calibration, furniture }: PlanState): Project => ({
  plan,
  calibration,
  furniture,
})

const sameProject = (a: Project, b: Project) =>
  a.plan === b.plan &&
  a.calibration === b.calibration &&
  a.furniture === b.furniture

const toSaved = ({ plan, calibration, furniture }: Project): SavedProject => ({
  plan: plan && { name: plan.name, image: plan.source },
  calibration,
  furniture,
})

/**
 * Keeps the store's project in `repository`: restores it on start, then saves
 * it whenever it changes, once changes pause.
 */
export function createProjectPersistence({
  store,
  repository,
  decodeImage,
  onNotice,
}: Options) {
  let lastSaved = persisted(store.getState())
  let timer: ReturnType<typeof setTimeout> | undefined
  let notice: ProjectNotice | null = null
  let stopped = false
  let unsubscribe = () => {}

  const notify = (next: ProjectNotice | null) => {
    if (stopped || next === notice) return
    notice = next
    onNotice(next)
  }

  // Once storage is known to be unavailable, failing saves are no news
  const saveFailed = () => {
    if (notice !== 'storage-unavailable') notify('save-failed')
  }

  const save = async () => {
    timer = undefined
    const project = persisted(store.getState())
    if (sameProject(project, lastSaved)) return
    lastSaved = project
    try {
      await repository.save(toSaved(project))
      // Storage works (again), so any notice about it no longer holds
      if (notice === 'save-failed' || notice === 'storage-unavailable') {
        notify(null)
      }
    } catch {
      saveFailed()
    }
  }

  /** The saved project with its plan image decoded, or null if none. */
  const load = async () => {
    const saved = await repository.load()
    if (!saved) return null
    let image: ImageBitmap | null = null
    if (saved.plan) {
      try {
        image = await decodeImage(saved.plan.image)
      } catch {
        throw new CorruptProjectError('The saved plan image could not be read.')
      }
    }
    return {
      plan: saved.plan &&
        image && {
          name: saved.plan.name,
          image,
          width: image.width,
          height: image.height,
          source: saved.plan.image,
        },
      calibration: saved.calibration,
      furniture: saved.furniture,
    }
  }

  const startAutosave = () => {
    if (stopped) return
    lastSaved = persisted(store.getState())
    unsubscribe = store.subscribe((state) => {
      if (sameProject(persisted(state), lastSaved)) return
      clearTimeout(timer)
      timer = setTimeout(() => void save(), SAVE_DELAY_MS)
    })
  }

  /**
   * Show a saved project that arrives after the app started empty, unless
   * the project has changed since: the user's work wins over the saved one.
   */
  const restoreLate = async (
    loading: ReturnType<typeof load>,
    viewport: Size,
  ) => {
    const atTimeout = persisted(store.getState())
    let project: Awaited<typeof loading>
    try {
      project = await loading
    } catch {
      return // The notice already says the project won't be saved
    }
    if (stopped || !sameProject(persisted(store.getState()), atTimeout)) {
      return project?.plan?.image.close()
    }
    if (project) {
      store.getState().restoreProject(project, viewport)
      lastSaved = persisted(store.getState())
    }
    // Storage works after all
    if (notice === 'storage-unavailable') notify(null)
  }

  return {
    /** Load the saved project into the store, then start saving changes. */
    restore: async (viewport: Size) => {
      const loading = load()
      let giveUp: ReturnType<typeof setTimeout> | undefined
      const timedOut = new Promise<typeof TIMED_OUT>((resolve) => {
        giveUp = setTimeout(() => resolve(TIMED_OUT), RESTORE_TIMEOUT_MS)
      })
      try {
        const project = await Promise.race([loading, timedOut])
        if (project === TIMED_OUT) {
          notify('storage-unavailable')
          startAutosave()
          void restoreLate(loading, viewport)
          return
        }
        // Stopped while loading: someone else owns the store now
        if (stopped) return project?.plan?.image.close()
        if (project) store.getState().restoreProject(project, viewport)
      } catch (e) {
        // Start empty; the app works in memory either way
        notify(
          e instanceof CorruptProjectError
            ? 'restore-failed'
            : 'storage-unavailable',
        )
      } finally {
        clearTimeout(giveUp)
      }
      startAutosave()
    },
    /** Drop the plan and everything on it, here and in storage. */
    newProject: async () => {
      clearTimeout(timer)
      store.getState().newProject()
      lastSaved = persisted(store.getState())
      try {
        await repository.clear()
      } catch {
        saveFailed()
      }
    },
    /** Stop saving changes. */
    stop: () => {
      stopped = true
      clearTimeout(timer)
      unsubscribe()
    },
  }
}
