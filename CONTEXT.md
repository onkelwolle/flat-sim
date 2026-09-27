# flat-sim

Planning furniture placement on a floor plan drawn to scale.

## Language

**Plan**:
The floor plan image the user opened. Its pixels are the coordinate space for everything drawn on it.
_Avoid_: floor plan file, background

**Plan pixels**:
Distances and positions measured in the plan image's own pixels, independent of zoom and pan.
_Avoid_: screen pixels (those depend on the view)

**View**:
How the plan is currently zoomed and panned on screen. Changing the view never changes anything measured on the plan.

**Scale**:
How many plan pixels make one real-world metre (`pixelsPerMetre`). All real-world lengths derive from it; until it is set, measuring tools are unavailable.
_Avoid_: zoom (that is the view's magnification)

**Calibration**:
A line drawn along a wall of known length, plus that real length, which together set the **Scale**. Re-calibrating replaces it; replacing the **Plan** drops it.

**Calibrate tool**:
The tool for drawing a **Calibration**: click both ends of a wall on the plan, then enter its real length in cm or m.

**Measuring tape**:
The tool for measuring the real distance between two points on the **Plan**: click, click or click-drag between them; holding Shift snaps the line to horizontal, vertical or 45°. Available only once the **Scale** is set. One tool is active at a time: starting the measuring tape leaves the **Calibrate tool**, and the other way round.
_Avoid_: ruler, measure tool

**Measurement**:
A straight line between two points on the **Plan**, in **Plan pixels**, shown with its real length (whole cm below a metre, else metres to two decimals). For now a measurement lasts only while the **Measuring tape** is active; leaving the tool drops it.
