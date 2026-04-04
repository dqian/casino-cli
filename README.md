<img width="371" height="138" alt="image" src="https://github.com/user-attachments/assets/d68d13cf-e4f6-421e-a3d7-308c55322bd0" />

# Casino CLI

Terminal-based casino games built with Bun + TypeScript. Zero external dependencies — pure ANSI escape codes for rendering.

## Games

- **Roulette** — European (single zero) with full bet support: straight, split, street, corner, trio, sixline, dozen, column, and outside bets. Features animated wheel spin with bouncing ball physics.

## Quick Start

```sh
bun run src/index.ts
```

## Alias

Add this to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```sh
alias casino='bun run ~/Documents/Repositories/casino-cli/src/index.ts'
```

Then just run:

```sh
casino
```
