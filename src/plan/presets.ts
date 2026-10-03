import type { FurnitureSpec } from './planStore'

/** A name, width and depth to fill the Add furniture form with. */
export type Preset = FurnitureSpec

/** The fixed catalogue of typical furniture, offered to every project. */
export const BUILT_IN_PRESETS: readonly Preset[] = [
  { name: 'Bed', widthCm: 90, depthCm: 200 },
  { name: 'Bed', widthCm: 140, depthCm: 200 },
  { name: 'Bed', widthCm: 160, depthCm: 200 },
  { name: 'Bed', widthCm: 180, depthCm: 200 },
  { name: 'Bedside table', widthCm: 45, depthCm: 40 },
  { name: 'Wardrobe', widthCm: 200, depthCm: 60 },
  { name: 'Chest of drawers', widthCm: 80, depthCm: 45 },
  { name: 'Sofa', widthCm: 210, depthCm: 95 },
  { name: 'Armchair', widthCm: 80, depthCm: 85 },
  { name: 'Coffee table', widthCm: 110, depthCm: 60 },
  { name: 'TV unit', widthCm: 160, depthCm: 40 },
  { name: 'Bookcase', widthCm: 80, depthCm: 30 },
  { name: 'Dining table', widthCm: 160, depthCm: 90 },
  { name: 'Chair', widthCm: 45, depthCm: 50 },
  { name: 'Desk', widthCm: 140, depthCm: 70 },
  { name: 'Office chair', widthCm: 65, depthCm: 65 },
  { name: 'Fridge', widthCm: 60, depthCm: 65 },
  { name: 'Washing machine', widthCm: 60, depthCm: 60 },
]

/** The part of the browser's `localStorage` that presets are kept in. */
export type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Where the user's presets are kept, shared by every project. */
export const PRESETS_KEY = 'flat-sim:presets'

const isSize = (cm: unknown) =>
  typeof cm === 'number' && Number.isFinite(cm) && cm > 0

const isPreset = (value: unknown): value is Preset => {
  if (typeof value !== 'object' || value === null) return false
  const { name, widthCm, depthCm } = value as Record<string, unknown>
  return (
    typeof name === 'string' &&
    name.trim() !== '' &&
    isSize(widthCm) &&
    isSize(depthCm)
  )
}

// Names compare ignoring case and accents: "Sofa" and "sofa" are one preset
const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
const sameName = (a: string, b: string) => collator.compare(a, b) === 0

/** The presets on offer: the built-ins, then the user's, by name. */
export type PresetList = {
  builtIn: readonly Preset[]
  user: Preset[]
}

/**
 * The presets on offer, built-in and saved by the user in `storage`. Saved
 * presets that can't be read, or storage that can't be reached, leave the
 * built-ins only.
 */
export function createPresetLibrary(storage: PresetStorage) {
  // Saved presets that can't be read, every one of them, count as none
  const read = (): Preset[] => {
    try {
      const saved: unknown = JSON.parse(storage.getItem(PRESETS_KEY) ?? '[]')
      return Array.isArray(saved) && saved.every(isPreset) ? saved : []
    } catch {
      return []
    }
  }

  // False if the browser refuses (storage blocked or full)
  const write = (presets: Preset[]) => {
    try {
      storage.setItem(PRESETS_KEY, JSON.stringify(presets))
      return true
    } catch {
      return false
    }
  }

  return {
    list: (): PresetList => ({ builtIn: BUILT_IN_PRESETS, user: read() }),
    /** Keep `preset`, replacing any of the same name; false if it can't be. */
    save: (preset: Preset) => {
      const saved = { ...preset, name: preset.name.trim() }
      const others = read().filter((p) => !sameName(p.name, saved.name))
      return write(
        [...others, saved].sort((a, b) => collator.compare(a.name, b.name)),
      )
    },
    /** Forget the saved preset called `name`; false if it can't be. */
    remove: (name: string) =>
      write(read().filter((p) => !sameName(p.name, name))),
  }
}

/**
 * The user's presets in this browser's `localStorage`, looked up on each use:
 * merely reaching for it throws where the browser blocks storage.
 */
export const presetLibrary = createPresetLibrary({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
})
