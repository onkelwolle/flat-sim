/** A state to return to, and the step that leads away from it. */
export type Entry<T, S> = { state: T; step: S }

/** How many steps are kept; older ones are forgotten. */
export const HISTORY_LIMIT = 100

/** How long a run of steps sharing a key may pause and still be one step. */
export const MERGE_WINDOW_MS = 1000

/**
 * Undo and redo over snapshots: each step keeps the state as it was before
 * it, and undoing swaps that for the current state, which redo returns to.
 * Keeps the last `HISTORY_LIMIT` steps; a new step drops any to redo.
 */
export function createHistory<T, S>({ now = Date.now } = {}) {
  const undos: Entry<T, S>[] = []
  const redos: Entry<T, S>[] = []
  // The run the last step belongs to, while more steps may join it
  let run: { key: string; at: number } | null = null

  return {
    /**
     * Remember `before`, the state as it was before `step` changed it. Steps
     * recorded one after another with the same `mergeKey`, each within
     * `MERGE_WINDOW_MS` of the last, are one step, undone back to before the
     * first.
     */
    record: (before: T, step: S, mergeKey?: string) => {
      const at = now()
      const joins =
        mergeKey !== undefined &&
        run?.key === mergeKey &&
        at - run.at <= MERGE_WINDOW_MS
      run = mergeKey === undefined ? null : { key: mergeKey, at }
      if (joins) return
      undos.push({ state: before, step })
      if (undos.length > HISTORY_LIMIT) undos.shift()
      redos.length = 0
    },
    /** The step undo would take back, or null if there is none. */
    nextUndo: (): S | null => undos.at(-1)?.step ?? null,
    /** The step redo would take again, or null if there is none. */
    nextRedo: (): S | null => redos.at(-1)?.step ?? null,
    /** The state before the last step, and that step; null if none. */
    undo: (current: T): Entry<T, S> | null => {
      run = null
      const entry = undos.pop()
      if (!entry) return null
      redos.push({ state: current, step: entry.step })
      return entry
    },
    /** The state after the last undone step, and that step; null if none. */
    redo: (current: T): Entry<T, S> | null => {
      run = null
      const entry = redos.pop()
      if (!entry) return null
      undos.push({ state: current, step: entry.step })
      return entry
    },
    /** Forget every step. */
    clear: () => {
      run = null
      undos.length = 0
      redos.length = 0
    },
    /** Every state kept to undo or redo to. */
    states: (): T[] => [...undos, ...redos].map((e) => e.state),
  }
}
