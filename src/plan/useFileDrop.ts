import { useEffect, useRef, useState } from 'react'

const carriesFiles = (e: DragEvent) =>
  e.dataTransfer?.types.includes('Files') ?? false

/**
 * Accept files dropped anywhere on the page while `enabled`. Returns whether
 * files are currently being dragged over it.
 */
export function useFileDrop(
  onDrop: (file: File) => void,
  enabled = true,
): boolean {
  const [dragging, setDragging] = useState(false)
  const onDropRef = useRef(onDrop)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    onDropRef.current = onDrop
    enabledRef.current = enabled
  })

  useEffect(() => {
    // dragenter/dragleave also fire when crossing child elements, so count them
    let depth = 0

    const onDragEnter = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth++
      setDragging(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDragOver = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault() // allow dropping, or refuse without navigating away
      if (e.dataTransfer)
        e.dataTransfer.dropEffect = enabledRef.current ? 'copy' : 'none'
    }
    const onDropFile = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault() // stop the browser from navigating to the file
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file && enabledRef.current) onDropRef.current(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDropFile)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDropFile)
    }
  }, [])

  return dragging && enabled
}
