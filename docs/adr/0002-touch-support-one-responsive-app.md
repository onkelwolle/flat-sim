# 2. Touch support as one responsive app, tablet first

Status: accepted (2026-09-28)

## Context

flat-sim was built for mouse, keyboard and trackpad. Users also want to plan on a tablet, and later on a phone. On touch today, zoom comes only from wheel and Safari `gesture*` events, a pinch zooms the whole page, and there is no way to pan while a tool is active (space+drag needs a keyboard). Touch targets and layout are sized for a mouse pointer.

## Decision

- One responsive app, no separate touch or mobile build and no user-agent sniffing
- Behaviour follows each event's `pointerType`: mouse behaves as before; touch and pen share the handling that makes up for having no keyboard or hover and for covering the point (loupe, magnetic snapping); only fingers count towards two-finger gestures
- Keyboard-only hints (Shift, Esc) show only when `(any-pointer: fine)` matches
- Sizing follows the `(any-pointer: coarse)` media query, so a touch laptop with a mouse still gets touch-sized targets
- Two fingers always pan and pinch-zoom the **View**, whatever tool is active or item is selected: the touch replacement for space+drag. A second finger cancels what the first was doing
- The stage sets `touch-action: none`; the browser never zooms or scrolls the page from the canvas, and there is no double-tap zoom
- Tablet first; phone layout follows as separate issues
- Layout follows the viewport's width, never input handling: below 600 px the main tools move to a bottom bar (the rest into its "⋯" menu), clear of the safe-area insets
- Touch is tested in a touch-emulated Chromium tablet Playwright project, with multi-finger gestures driven through CDP `Input.dispatchTouchEvent`; gesture maths is unit-tested

## Considered alternatives

- A separate mobile app or route: duplicates every tool and drifts from the desktop app.
- Deciding by device (user agent, screen width): wrong on touch laptops, tablets with keyboards and pens.
- Sizing by `(pointer: coarse)`: only looks at the primary pointer, so a touch laptop would get mouse-sized targets.
- Konva's own multi-touch handling: it drags shapes per finger but has no view pinch, and would fight the tools for the second finger.

## Consequences

Every new pointer interaction has to decide what a second finger does (by default: cancel and hand over to the view). Hover-only affordances (cursors, tooltips) need a touch equivalent. Safari reports finger pinches as `gesture*` events as well as touches, so those zoom only when no finger is on the canvas.

Follow-ups: a loupe for placing points precisely (#64), touch-sized buttons and handles (#65), magnetic snapping for the measuring tape (#39), and the phone layout: bottom tool bar (#66), item panel as a bottom sheet (#67), full-screen dialogs (#68).
