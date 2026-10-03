import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_PRESETS,
  createPresetLibrary,
  PRESETS_KEY,
  type PresetStorage,
} from './presets'

/** Browser storage held in a map, as `localStorage` would hold it. */
const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  } satisfies PresetStorage
}

describe('preset library', () => {
  it('offers the built-in presets when nothing is saved', () => {
    const library = createPresetLibrary(memoryStorage())

    expect(library.list()).toEqual({ builtIn: BUILT_IN_PRESETS, user: [] })
    expect(BUILT_IN_PRESETS).toContainEqual({
      name: 'Bed',
      widthCm: 160,
      depthCm: 200,
    })
  })

  it('keeps saved presets for later visits, after the built-ins', () => {
    const storage = memoryStorage()
    createPresetLibrary(storage).save({
      name: 'Piano',
      widthCm: 150,
      depthCm: 60,
    })

    expect(createPresetLibrary(storage).list()).toEqual({
      builtIn: BUILT_IN_PRESETS,
      user: [{ name: 'Piano', widthCm: 150, depthCm: 60 }],
    })
  })

  it('lists saved presets by name; saving a name again replaces it', () => {
    const library = createPresetLibrary(memoryStorage())
    library.save({ name: 'Piano', widthCm: 150, depthCm: 60 })
    library.save({ name: 'armchair', widthCm: 80, depthCm: 80 })
    library.save({ name: 'Cat tree', widthCm: 50, depthCm: 50 })
    library.save({ name: 'Piano ', widthCm: 160, depthCm: 65 })

    expect(library.list().user).toEqual([
      { name: 'armchair', widthCm: 80, depthCm: 80 },
      { name: 'Cat tree', widthCm: 50, depthCm: 50 },
      { name: 'Piano', widthCm: 160, depthCm: 65 },
    ])
  })

  it.each([
    ['not JSON', '{oops'],
    ['not a list', '{"name":"Piano","widthCm":150,"depthCm":60}'],
    ['a preset without a size', '[{"name":"Piano","widthCm":150}]'],
    ['a preset without a name', '[{"name":" ","widthCm":150,"depthCm":60}]'],
    ['a size of zero', '[{"name":"Piano","widthCm":0,"depthCm":60}]'],
  ])('offers only the built-ins when storage holds %s', (_, json) => {
    const library = createPresetLibrary(memoryStorage({ [PRESETS_KEY]: json }))

    expect(library.list()).toEqual({ builtIn: BUILT_IN_PRESETS, user: [] })
  })

  it('offers only the built-ins when storage is unavailable', () => {
    const library = createPresetLibrary({
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    })

    expect(library.list()).toEqual({ builtIn: BUILT_IN_PRESETS, user: [] })
    expect(library.save({ name: 'Piano', widthCm: 150, depthCm: 60 })).toBe(
      false,
    )
  })

  it('says whether a preset was saved', () => {
    const storage = memoryStorage()
    const library = createPresetLibrary({
      getItem: storage.getItem,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    })

    expect(library.save({ name: 'Piano', widthCm: 150, depthCm: 60 })).toBe(
      false,
    )
    expect(library.list().user).toEqual([])
    expect(
      createPresetLibrary(storage).save({
        name: 'Piano',
        widthCm: 150,
        depthCm: 60,
      }),
    ).toBe(true)
  })

  it('deletes a saved preset for good', () => {
    const storage = memoryStorage()
    const library = createPresetLibrary(storage)
    library.save({ name: 'Piano', widthCm: 150, depthCm: 60 })
    library.save({ name: 'Cat tree', widthCm: 50, depthCm: 50 })

    library.remove('Piano')

    expect(createPresetLibrary(storage).list().user).toEqual([
      { name: 'Cat tree', widthCm: 50, depthCm: 50 },
    ])
  })
})
