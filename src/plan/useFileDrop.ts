import { useEffect, useRef, useState } from 'react'

const carriesFiles = (e: DragEvent) =>
  e.dataTransfer?.types.includes('Files') ?? false

/**
 * Accept files dropped anywhere on the page. Returns whether files are
 * currently being dragged over it.
 */
export function useFileDrop(onDrop: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false)
  const onDropRef = useRef(onDrop)

  useEffect(() => {
    onDropRef.current = onDrop
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
      e.preventDefault() // allow dropping
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDropFile = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault() // stop the browser from navigating to the file
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) onDropRef.current(file)
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

  return dragging
}
