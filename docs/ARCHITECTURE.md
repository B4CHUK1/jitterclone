# Jitter — Architecture (Bloc A)

## Overview

Jitter is a 2D motion design tool built for the browser. The architecture follows a strict separation between **document model**, **engine**, **state management**, and **UI**.

This document describes the Bloc A foundation: the core systems needed before timeline, keyframes, or advanced layout can be added.

---

## Stack

| Layer       | Tech           |
|-------------|----------------|
| Language    | TypeScript (strict) |
| UI          | React 19       |
| Renderer    | PixiJS 8       |
| State       | Zustand        |
| Build       | Vite           |
| Tests       | Vitest + Playwright |
| Styling     | CSS Modules + CSS Variables |

---

## Directory Structure

```
src/
├── app/              # App shell, keyboard shortcuts
├── document/         # Serializable document model (types + pure operations)
├── engine/
│   ├── interaction/  # Hit testing, drag/resize/rotate/marquee logic
│   ├── renderer/     # PixiJS renderer (decoupled from React)
│   ├── scene/        # Scene graph builder (doc → renderable tree)
│   ├── transform/    # Math primitives, matrix ops, coordinate transforms
│   └── viewport/     # Viewport (pan/zoom) controller
├── state/            # Zustand stores (document, editor, viewport)
├── styles/           # Global CSS, variables, reset
└── ui/
    ├── components/   # Toolbar, Canvas
    ├── overlays/     # Selection overlay (handles, marquee)
    └── panels/       # Properties panel
tests/
├── unit/             # Math, transform, document, scene graph
├── integration/      # Selection + transform interactions
└── e2e/              # (Placeholder for Playwright tests)
```

---

## Core Concepts

### 1. Document Model (`src/document/`)

The document is the **serializable source of truth**. It represents a scene as a flat record of `SceneNode` objects with parent-child relationships.

- **Immutable**: all operations return new document objects
- **Pure**: no side effects, no dependencies on React or the renderer
- **Extensible**: new node types, properties, or metadata can be added without touching the engine

Key types:
- `SceneNode` — id, type, parentId, transform, style, visibility, lock
- `Document` — id, name, dimensions, nodes record, root node ids

### 2. Transform System (`src/engine/transform/`)

All spatial math lives here. Two files:

- **`math.ts`** — Vec2, Matrix2D, angle utilities, bounding boxes. Pure functions, zero dependencies.
- **`transform.ts`** — Converts a `Transform` (position, size, rotation, scale, anchor) into a 2D affine matrix. Handles parent-child chains.

The transform order is: `T(position) × T(anchor) × R × S × T(-anchor)`

This ensures rotation and scale happen around the anchor point.

### 3. Scene Graph (`src/engine/scene/`)

Converts the flat document into a renderable tree with computed world matrices. Built fresh each frame (cheap for hundreds of nodes).

- `buildSceneGraph(doc)` → `RenderNode[]`
- Each `RenderNode` has: node data, local matrix, world matrix, children
- `flattenSceneGraph` for iteration, `findRenderNode` for lookup

### 4. Renderer (`src/engine/renderer/`)

PixiJS 8 renderer, completely decoupled from React:

- Owns the `Application`, `Container` tree, and `Graphics` objects
- `render(sceneRoots)` syncs Pixi display objects with the scene graph
- Creates/updates/removes Graphics as nodes change
- Viewport transform (pan/zoom) applied to the world container

The renderer does NOT handle interaction, selection, or UI. It just draws.

### 5. Interaction System (`src/engine/interaction/`)

Pure functions that compute new transforms during user interactions:

- **Hit testing** — point-in-element (local coords), rectangle intersection (AABB), handle hit testing
- **Drag** — stores start positions, computes deltas
- **Resize** — handles all 8 directions with rotation-aware axis decomposition
- **Rotate** — around anchor point, with optional 15° snapping
- **Marquee** — rubber-band selection rectangle

All interaction functions are pure: they take state in, return state out. No side effects.

### 6. Viewport (`src/engine/viewport/`)

Pure functions for zoom-at-point and pan. The viewport store holds zoom/pan state, and the controller computes new state from wheel/pinch events.

### 7. State Management (`src/state/`)

Three Zustand stores with clear responsibilities:

| Store | Data | Persistence |
|-------|------|-------------|
| `documentStore` | Scene nodes, document metadata | Serializable (future file save) |
| `editorStore` | Selection, active tool, interaction mode | Transient |
| `viewportStore` | Zoom, pan, container size | Transient |

### 8. UI Layer (`src/ui/`)

React components that wire stores to the engine:

- **Canvas** — mounts the PixiJS canvas, handles all pointer events, orchestrates interactions
- **SelectionOverlay** — HTML/SVG overlay for selection outlines, handles, marquee
- **Toolbar** — tool selection, shape creation
- **PropertiesPanel** — edits transform/style of selected node

---

## Data Flow

```
User Input (pointer/keyboard)
    ↓
Canvas component (event handlers)
    ↓
Interaction functions (pure math)
    ↓
Zustand stores (document + editor)
    ↓
React re-render triggers
    ↓
Scene graph rebuild
    ↓
PixiJS renderer sync
    ↓
Screen
```

---

## Coordinate Spaces

1. **Screen space** — pixels on the browser window
2. **Canvas space** — screen space offset by the canvas container position
3. **World space** — after applying inverse viewport (pan/zoom). Document coordinates.
4. **Local space** — element-relative, after applying inverse world matrix

Conversions: `viewportStore.screenToWorld()`, `viewportStore.worldToScreen()`, `worldToLocal()`, `localToWorld()`.

---

## What's Next (Bloc B+)

The architecture is explicitly designed for these future additions:

- **Timeline + keyframes**: The `Transform` and `NodeStyle` are structured to support time-varying properties. Add a `keyframes` array per property.
- **Playback engine**: A `PlaybackController` can interpolate transforms at any time `t` and feed them to the scene graph.
- **Layout engine**: The parent-child hierarchy and world matrix system support nested transforms. A layout engine can compute child positions before the scene graph build.
- **Undo/redo**: The immutable document model makes this trivial — store document snapshots or diffs.
- **Serialization**: The document model is a plain JSON-serializable object.
- **Media layers**: New `NodeType` values (image, video, text) with type-specific rendering in the PixiJS renderer.
