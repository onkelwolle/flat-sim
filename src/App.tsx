import { Layer, Stage } from 'react-konva'
import { useViewportSize } from './useViewportSize'

function App() {
  const { width, height } = useViewportSize()

  return (
    <Stage width={width} height={height} data-testid="plan-stage">
      <Layer />
    </Stage>
  )
}

export default App
