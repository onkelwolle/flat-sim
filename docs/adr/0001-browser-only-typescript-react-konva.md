# 1. Browser-only app on TypeScript, React and Konva

Status: accepted (2026-09-27)

## Context

flat-sim lets a user upload a floor plan, calibrate its scale from one known wall length, measure distances and place furniture to scale. It is a 2D canvas editor: large raster background, draggable/rotatable shapes, zoom/pan, pixel↔real-unit conversion. No multi-user or server features are needed initially.

## Decision

- TypeScript (strict), Vite, React
- Canvas via Konva / react-konva (drag, Transformer handles, layers, hit detection)
- State in Zustand; persistence in IndexedDB (`idb`); no backend
- pdf.js for PDF plans (when needed)
- Vitest for domain/geometry logic, Playwright for e2e
- Hosted as a static site on GitHub Pages

Scale is stored as plan-image pixels per metre; furniture dimensions are stored in centimetres so re-calibration keeps sizes correct.

## Considered alternatives

- SVG rendering: simpler DOM, but slower with large plan images and needs hand-built transform handles.
- Fabric.js: capable, but less idiomatic with React.
- Svelte: leaner, but a smaller canvas-tooling ecosystem.

## Consequences

Data lives only in the user's browser until an export/import or sharing feature adds a way out. Sharing (#22) will require revisiting the no-backend decision.
