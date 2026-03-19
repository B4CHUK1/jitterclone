# Jitter

A 2D motion design tool for the browser, built with React, PixiJS, and TypeScript.

## Quick Start

```bash
pnpm install
pnpm dev
```

## Stack

- **React 19** — UI framework
- **PixiJS 8** — 2D rendering engine
- **Zustand** — State management
- **TypeScript** — Strict mode
- **Vite** — Build tool
- **Vitest** — Unit & integration tests
- **CSS Modules** — Scoped styling

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture overview.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Type-check + production build |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Lint source code |
| `pnpm format` | Format source code |

## Current Features (Bloc A)

- Canvas with PixiJS rendering
- Viewport pan (scroll/drag) and zoom (Ctrl+scroll, centered on cursor)
- Shape creation (rectangle, ellipse)
- Single select, multi-select, marquee select
- Move, resize (8 handles), rotate (4 corner handles)
- Anchor point system
- Nested coordinate system with world matrices
- Properties panel for transform and style editing
- Keyboard shortcuts (V/R/O/H tools, Delete, Escape)
