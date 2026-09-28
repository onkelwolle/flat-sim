import { describe, expect, it } from 'vitest'
import { createHistory, MERGE_WINDOW_MS } from './history'

describe('history', () => {
  it('undoes a step back to the state before it, then redoes it', () => {
    const history = createHistory<string, string>()

    history.record('a', 'edit 1')

    expect(history.undo('b')).toEqual({ state: 'a', step: 'edit 1' })
    expect(history.redo('a')).toEqual({ state: 'b', step: 'edit 1' })
  })

  it('has nothing to undo or redo at first', () => {
    const history = createHistory<string, string>()

    expect(history.nextUndo()).toBeNull()
    expect(history.nextRedo()).toBeNull()
    expect(history.undo('a')).toBeNull()
    expect(history.redo('a')).toBeNull()
  })

  it('names the steps that undo and redo would take', () => {
    const history = createHistory<string, string>()
    history.record('a', 'edit 1')
    history.record('b', 'edit 2')

    expect(history.nextUndo()).toBe('edit 2')
    history.undo('c')

    expect(history.nextUndo()).toBe('edit 1')
    expect(history.nextRedo()).toBe('edit 2')
  })

  it('undoes steps last first, and redoes them in order', () => {
    const history = createHistory<string, string>()
    history.record('a', 'edit 1')
    history.record('b', 'edit 2')

    expect(history.undo('c')?.state).toBe('b')
    expect(history.undo('b')?.state).toBe('a')
    expect(history.redo('a')?.state).toBe('b')
    expect(history.redo('b')?.state).toBe('c')
    expect(history.redo('c')).toBeNull()
  })

  it('drops the redo steps when a new step is recorded after an undo', () => {
    const history = createHistory<string, string>()
    history.record('a', 'edit 1')
    history.undo('b')

    history.record('a', 'edit 2')

    expect(history.nextRedo()).toBeNull()
    expect(history.undo('c')).toEqual({ state: 'a', step: 'edit 2' })
    expect(history.undo('a')).toBeNull()
  })

  it('keeps at most 100 steps, dropping the oldest', () => {
    const history = createHistory<number, string>()
    for (let i = 0; i < 101; i++) history.record(i, `edit ${i}`)

    let undone = 0
    let state = 101
    for (let entry; (entry = history.undo(state)); undone++) state = entry.state

    expect(undone).toBe(100)
    expect(state).toBe(1)
  })

  it('forgets every step when cleared', () => {
    const history = createHistory<string, string>()
    history.record('a', 'edit 1')
    history.record('b', 'edit 2')
    history.undo('c')

    history.clear()

    expect(history.nextUndo()).toBeNull()
    expect(history.nextRedo()).toBeNull()
  })

  it('lists every state it holds, to undo or to redo', () => {
    const history = createHistory<string, string>()
    history.record('a', 'edit 1')
    history.record('b', 'edit 2')
    history.undo('c')

    expect([...history.states()].sort()).toEqual(['a', 'c'])
  })

  describe('merging a run of steps', () => {
    const run = () => {
      let time = 0
      const history = createHistory<string, string>({ now: () => time })
      return {
        history,
        wait: (ms: number) => {
          time += ms
        },
      }
    }

    it('merges steps with the same key into one, undone back to before the first', () => {
      const { history, wait } = run()
      history.record('a', 'nudge 1', 'sofa')
      wait(300)
      history.record('b', 'nudge 2', 'sofa')
      wait(900)
      history.record('c', 'nudge 3', 'sofa')

      expect(history.undo('d')).toEqual({ state: 'a', step: 'nudge 1' })
      expect(history.undo('a')).toBeNull()
    })

    it('starts a new step once the run pauses', () => {
      const { history, wait } = run()
      history.record('a', 'nudge 1', 'sofa')
      wait(MERGE_WINDOW_MS + 1)
      history.record('b', 'nudge 2', 'sofa')

      expect(history.undo('c')?.state).toBe('b')
      expect(history.undo('b')?.state).toBe('a')
    })

    it('starts a new step for another key', () => {
      const { history } = run()
      history.record('a', 'nudge sofa', 'sofa')
      history.record('b', 'nudge bed', 'bed')

      expect(history.undo('c')?.state).toBe('b')
    })

    it('ends the run at any other step', () => {
      const { history } = run()
      history.record('a', 'nudge 1', 'sofa')
      history.record('b', 'rename')
      history.record('c', 'nudge 2', 'sofa')

      expect(history.undo('d')?.state).toBe('c')
      expect(history.undo('c')?.state).toBe('b')
    })

    it('ends the run at an undo or redo', () => {
      const { history } = run()
      history.record('a', 'nudge 1', 'sofa')
      history.undo('b')
      history.redo('a')
      history.record('b', 'nudge 2', 'sofa')

      expect(history.undo('c')?.state).toBe('b')
      expect(history.undo('b')?.state).toBe('a')
    })
  })
})
