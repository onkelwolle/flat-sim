import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import { createIndexedDbProjectRepository } from './indexedDbProjectRepository'
import { CorruptProjectError, type SavedProject } from './projectRepository'

let databases = 0
/** A repository on a database of its own, so tests do not share records. */
const setUp = () => {
  const name = `flat-sim-test-${++databases}`
  return { name, repository: createIndexedDbProjectRepository(name) }
}

const project: SavedProject = {
  plan: {
    name: 'flat.png',
    image: new Blob(['png bytes'], { type: 'image/png' }),
  },
  calibration: {
    start: { x: 100, y: 100 },
    end: { x: 300, y: 100 },
    lengthCm: 400,
    scale: { pixelsPerMetre: 50 },
  },
  furniture: [
    {
      id: 'item-1',
      name: 'Sofa',
      widthCm: 200,
      depthCm: 90,
      position: { x: 400, y: 300 },
      rotationDeg: 45,
    },
  ],
}

/** Put a raw record where the repository keeps the project. */
const writeRaw = async (name: string, record: unknown) => {
  await createIndexedDbProjectRepository(name).load()
  const db = await openDB(name)
  await db.put('projects', record, 'current')
  db.close()
}

describe('IndexedDB project repository', () => {
  it('has no project until one is saved', async () => {
    const { repository } = setUp()

    expect(await repository.load()).toBeNull()
  })

  it('loads back the saved project, plan image included', async () => {
    const { repository } = setUp()

    await repository.save(project)
    const loaded = await repository.load()

    expect(loaded?.calibration).toEqual(project.calibration)
    expect(loaded?.furniture).toEqual(project.furniture)
    expect(loaded?.plan?.name).toBe('flat.png')
    expect(await loaded?.plan?.image.text()).toBe('png bytes')
    expect(loaded?.plan?.image.type).toBe('image/png')
  })

  it('keeps only the latest save', async () => {
    const { repository } = setUp()
    await repository.save(project)

    await repository.save({ plan: null, calibration: null, furniture: [] })

    expect(await repository.load()).toEqual({
      plan: null,
      calibration: null,
      furniture: [],
    })
  })

  it('keeps the project across repositories on the same database', async () => {
    const { name, repository } = setUp()
    await repository.save(project)

    const reopened = createIndexedDbProjectRepository(name)

    expect((await reopened.load())?.furniture).toEqual(project.furniture)
  })

  it('forgets the project once cleared', async () => {
    const { repository } = setUp()
    await repository.save(project)

    await repository.clear()

    expect(await repository.load()).toBeNull()
  })

  it('reports a record it cannot read as corrupt', async () => {
    for (const record of [
      'nonsense',
      { version: 99, project },
      { version: 1, project: { ...project, furniture: 'none' } },
      { version: 1, project: { ...project, plan: { name: 'flat.png' } } },
      {
        version: 1,
        project: {
          ...project,
          furniture: [{ ...project.furniture[0], id: 7 }],
        },
      },
      {
        version: 1,
        project: { ...project, calibration: { lengthCm: 400 } },
      },
    ]) {
      const { name, repository } = setUp()
      await writeRaw(name, record)

      await expect(repository.load()).rejects.toBeInstanceOf(
        CorruptProjectError,
      )
    }
  })
})
