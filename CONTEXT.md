# flat-sim

Planning furniture placement on a floor plan drawn to scale.

## Language

**Project**:
Everything the user is working on: the **Plan**, its **Calibration** and the **Furniture**. There is one project at a time. It is saved in the browser as it changes (once changes pause for half a second) and restored, fitted to the screen, when the app opens again; the **View**, the **Selection**, the active tool and any **Measurement** are not kept. Starting a new project drops all of it, here and in storage, after the user confirms. On the first save the app asks the browser to keep the saved project rather than clear it when space runs low; if the browser can't or won't, nothing is said. If storage is unavailable or fails, the app keeps working and says the project won't be saved. If restoring takes longer than 5 seconds, the app starts empty with that notice; a saved project that arrives later is shown only if the user hasn't changed anything yet, otherwise their work wins.
_Avoid_: document, session, file

**Plan**:
The floor plan image the user opened. Its pixels are the coordinate space for everything drawn on it.
_Avoid_: floor plan file, background

**Plan pixels**:
Distances and positions measured in the plan image's own pixels, independent of zoom and pan.
_Avoid_: screen pixels (those depend on the view)

**View**:
How the plan is currently zoomed and panned on screen: the wheel or a pinch (trackpad or two fingers) zooms it; dragging empty canvas, space+drag or two fingers pan it. Two fingers always pan and zoom, whatever tool is active or item is selected; a second finger landing cancels what the first was doing. Changing the view never changes anything measured on the plan.

**Scale**:
How many plan pixels make one real-world metre (`pixelsPerMetre`). All real-world lengths derive from it; until it is set, measuring tools are unavailable.
_Avoid_: zoom (that is the view's magnification)

**Calibration**:
A line drawn along a wall of known length, plus that real length, which together set the **Scale**. Re-calibrating replaces it; replacing the **Plan** drops it.

**Calibrate tool**:
The tool for drawing a **Calibration**: tap or click both ends of a wall on the plan, then enter its real length in cm or m. A click places its point at once; a finger or pen places it where it lifts, see **Loupe**. Points already placed stay when a second finger lands; the one being placed is not placed.

**Measuring tape**:
The tool for measuring the real distance between two points on the **Plan**: tap or click each, or drag between them. With a mouse, holding Shift snaps the line to horizontal, vertical or 45°; by finger or pen the line snaps there by itself (magnetically) whenever it comes within 5° of one, and never otherwise. By finger or pen, the second tap's end and a drag's end go where the finger lifts, see **Loupe**, which shows the end as snapped; lifting off the plan ends a drag with no measurement, and leaves a second end unplaced. A second finger landing cancels only the press under way: a drag's measurement is dropped, but a first end already placed stays, so tap one end, pinch or pan, tap the other works. The status bar mentions Shift and Esc only when there is a mouse or trackpad. Available only once the **Scale** is set. One tool is active at a time: starting the measuring tape leaves the **Calibrate tool**, and the other way round.
_Avoid_: ruler, measure tool

**Loupe**:
While a finger or pen is down placing a point with the **Calibrate tool** or **Measuring tape**, a circle about 100 px above-left of it (below it near the top edge, right of it near the left edge) shows the plan under it at twice the **View**'s zoom, with a crosshair on the point. The finger can slide to adjust; the point goes where it lifts, and nowhere if it lifts off the plan or the canvas. A mouse places points where it presses, with no loupe. A second finger landing hides it.
_Avoid_: magnifier, zoom lens

**Measurement**:
A straight line between two points on the **Plan**, in **Plan pixels**, shown with its real length (whole cm below a metre, else metres to two decimals). For now a measurement lasts only while the **Measuring tape** is active; leaving the tool drops it, and so does a second finger landing while its first end is being dragged out.

**Item** (of furniture):
A rectangle standing for a piece of furniture, with a name and a real width and depth in cm. Its size is kept in cm and drawn through the **Scale**, so re-calibrating redraws it at its correct real size; its centre is a point in **Plan pixels**, and it has a clockwise rotation in degrees (0–360). Items can be added only once the **Scale** is set; a new item appears centred in the **View**. The add form opens with the name, width and depth last added (remembered in memory for the session only; empty after a reload). Dragging an item moves it (never the **View**); a second finger landing mid-drag snaps it back. The selected item's rotate handle turns it in 15° steps, or freely with Shift held; arrow keys **nudge** the selected item 1 cm (10 cm with Shift), and R turns it to the next 15° step clockwise (Shift+R counter-clockwise), so an item off the 15° grid lands on it. While it is selected, its width and depth are labelled on the plan along its bottom and right edges, following it as it moves, turns or is resized, and reading from the bottom or the right however it is turned. Its name, its width and depth in cm and its rotation in degrees are edited in the side panel, which shows while it is selected (on a phone-narrow screen, a sheet resting on the bottom bar that opens expanded on each selection, collapses to its title row to show more of the plan, and rises above the on-screen keyboard); a typed rotation outside 0–360° is wrapped into it (370° is 10°, -90° is 270°). Replacing the **Plan** drops all items.
_Avoid_: object, shape, piece

**Furniture**:
All the **Items** placed on the **Plan**.

**Selection**:
The one **Item** currently being worked on, or none. Adding an item selects it; tapping or clicking an item selects it; tapping or clicking empty canvas (without panning) or pressing Esc selects none. A second finger never changes the selection. Delete removes the selected item. Selection and tools exclude each other: starting the **Calibrate tool** or **Measuring tape** clears the selection, and selecting an item leaves the active tool.

**Undo** / **Redo**:
Taking back the last **Step**, or making an undone step again (Ctrl+Z / Cmd+Z; Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y; or the toolbar buttons, whose tooltips name the step). Only the **Project** is undone: never a **Measurement**, the **Selection** or the **View**. Afterwards the item the step touched is selected, or nothing if the step removed it or concerned no single item; an active tool stays active instead, except that the **Measuring tape** closes if the **Scale** goes. With calibration points placed, undo first just leaves the **Calibrate tool**. Shortcuts do nothing while a dialog is open, in a text field, or during a drag or turn. The history lives in memory only, keeps the last 100 steps, and starts empty on a new project or a restore.
_Avoid_: history entry, revert

**Step**:
One completed edit to the **Project**, undone and redone as a whole: adding, moving (one drag), turning (one turn of the rotate handle or one press of R; a drag or turn cut short by a second finger is none), renaming, resizing or deleting an item, one field edit in the side panel, confirming a **Calibration**, or replacing the **Plan**. A run of nudges to the same item is one step, ended by any other edit or a second without nudging. A new step drops any steps that were undone.
_Avoid_: action, change, operation
