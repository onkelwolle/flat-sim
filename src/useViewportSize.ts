import { useEffect, useState } from 'react'

export type Size = { width: number; height: number }

const read = (): Size => ({
  width: window.innerWidth,
  height: window.innerHeight,
})

export function useViewportSize(): Size {
  const [size, setSize] = useState(read)

  useEffect(() => {
    const onResize = () => setSize(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return size
}
