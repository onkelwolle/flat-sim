# flat-sim

Planning furniture placement on a floor plan drawn to scale.

## Language

**Project**:
Everything the user is working on: the **Plan**, its **Calibration** and the **Furniture**. There is one project at a time. It is saved in the browser as it changes (once changes pause for half a second) and restored, fitted to the screen, when the app opens again; the **View**, the **Selection**, the active tool and any **Measurement** are not kept. Starting a new project drops all of it, here and in storage, after the user confirms. If storage is unavailable or fails, the app keeps working and says the project won't be saved. If restoring takes longer than 5 seconds, the app starts empty with that notice; a saved project that arrives later is shown only if the user hasn't changed anything yet, otherwise their work wins.
_Avoid_: document, session, file

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

**Item** (of furniture):
A rectangle standing for a piece of furniture, with a name and a real width and depth in cm. Its size is kept in cm and drawn through the **Scale**, so re-calibrating redraws it at its correct real size; its centre is a point in **Plan pixels**, and it has a clockwise rotation in degrees (0–360). Items can be added only once the **Scale** is set; a new item appears centred in the **View**. Dragging an item moves it (never the **View**); the selected item's rotate handle turns it in 15° steps, or freely with Shift held; arrow keys **nudge** the selected item 1 cm (10 cm with Shift). Its name, its width and depth in cm and its rotation in degrees are edited in the side panel, which shows while it is selected; a typed rotation outside 0–360° is wrapped into it (370° is 10°, -90° is 270°). Replacing the **Plan** drops all items.
_Avoid_: object, shape, piece

**Furniture**:
All the **Items** placed on the **Plan**.

**Selection**:
The one **Item** currently being worked on, or none. Adding an item selects it; clicking an item selects it; clicking empty canvas (without panning) or pressing Esc selects none. Delete removes the selected item. Selection and tools exclude each other: starting the **Calibrate tool** or **Measuring tape** clears the selection, and selecting an item leaves the active tool.

**Undo** / **Redo**:
Taking back the last **Step**, or making an undone step again (Ctrl+Z / Cmd+Z; Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y; or the toolbar buttons, whose tooltips name the step). Only the **Project** is undone: never a **Measurement**, the **Selection** or the **View**. Afterwards the item the step touched is selected, or nothing if the step removed it or concerned no single item; an active tool stays active instead, except that the **Measuring tape** closes if the **Scale** goes. With calibration points placed, undo first just leaves the **Calibrate tool**. Shortcuts do nothing while a dialog is open, in a text field, or during a drag or turn. The history lives in memory only, keeps the last 100 steps, and starts empty on a new project or a restore.
_Avoid_: history entry, revert

**Step**:
One completed edit to the **Project**, undone and redone as a whole: adding, moving (one drag), turning (one turn of the rotate handle), renaming, resizing or deleting an item, one field edit in the side panel, confirming a **Calibration**, or replacing the **Plan**. A run of nudges to the same item is one step, ended by any other edit or a second without nudging. A new step drops any steps that were undone.
_Avoid_: action, change, operation
