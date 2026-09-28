import { describe, expect, it } from 'vitest'
import { isDialogOpen, openDialog } from './dialogs'

describe('dialogs', () => {
  it('is open while any dialog is open', () => {
    expect(isDialogOpen()).toBe(false)

    const closeFirst = openDialog()
    const closeSecond = openDialog()
    closeFirst()
    expect(isDialogOpen()).toBe(true)

    closeSecond()
    expect(isDialogOpen()).toBe(false)
  })

  it('counts closing the same dialog twice once', () => {
    const closeFirst = openDialog()
    const closeSecond = openDialog()

    closeFirst()
    closeFirst()
    expect(isDialogOpen()).toBe(true)

    closeSecond()
    expect(isDialogOpen()).toBe(false)
  })
})
