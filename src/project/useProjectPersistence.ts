import { useCallback, useEffect, useRef, useState } from 'react'
import { planStore } from '../plan/planStore'
import type { Size } from '../useViewportSize'
import { createIndexedDbProjectRepository } from './indexedDbProjectRepository'
import {
  createProjectPersistence,
  type ProjectNotice,
} from './projectPersistence'

type Persistence = ReturnType<typeof createProjectPersistence>

/**
 * Restores the saved project into the plan store on mount, then keeps it
 * saved in IndexedDB. `restoring` holds until the saved project is shown, or
 * until restoring takes too long and the app starts empty.
 */
export function useProjectPersistence(viewport: Size) {
  const [restoring, setRestoring] = useState(true)
  const [notice, setNotice] = useState<ProjectNotice | null>(null)
  const persistence = useRef<Persistence | null>(null)
  // The restored plan is fitted to the viewport at mount
  const [initialViewport] = useState(viewport)

  useEffect(() => {
    const current = createProjectPersistence({
      store: planStore,
      repository: createIndexedDbProjectRepository(),
      // Missing outside secure contexts, whatever the DOM types say
      storage: navigator.storage as StorageManager | undefined,
      decodeImage: (image) => createImageBitmap(image),
      onNotice: setNotice,
    })
    persistence.current = current
    void current.restore(initialViewport).then(() => setRestoring(false))
    return () => current.stop()
  }, [initialViewport])

  const newProject = useCallback(() => {
    void persistence.current?.newProject()
  }, [])
  const dismissNotice = useCallback(() => setNotice(null), [])

  return { restoring, notice, dismissNotice, newProject }
}
