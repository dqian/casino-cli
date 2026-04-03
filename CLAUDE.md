# Casino CLI

Terminal-based casino games TUI built with Bun + TypeScript. Zero external dependencies — uses raw ANSI escape codes for rendering.

## Running

```sh
bun run src/index.ts
```

## Architecture

- `src/index.ts` — Entry point
- `src/tui.ts` — Main TUI loop, state management, key handling
- `src/renderer.ts` — Main menu rendering
- `src/theme.ts` — ANSI escape code helpers
- `src/keybindings.ts` — Terminal key parsing
- `src/types.ts` — Shared TypeScript types
- `src/roulette/` — Roulette game module
  - `board.ts` — Board layout, win/payout logic
  - `game.ts` — Game state mutations (bet, spin, clear)
  - `renderer.ts` — Roulette screen rendering

## Conventions

- Use Bun, not Node/npm
- No external TUI libraries — raw ANSI escape sequences only
- Custom key parsing from raw stdin buffer
- Alt screen mode to prevent scroll contamination
- Centralized AppState object passed through all functions
- Immediate re-render on state changes
