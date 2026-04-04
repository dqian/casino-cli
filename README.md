<img width="371" height="138" alt="image" src="https://github.com/user-attachments/assets/d68d13cf-e4f6-421e-a3d7-308c55322bd0" />

# Casino CLI

Terminal-based casino games built with Bun + TypeScript. Zero external dependencies — pure ANSI escape codes for rendering.

## Games

- **Roulette** — European (single zero) with full bet support: straight, split, street, corner, trio, sixline, dozen, column, and outside bets. Features animated wheel spin with bouncing ball physics.

## Quick Start

Install [Bun](https://bun.sh) if you don't have it:

```sh
curl -fsSL https://bun.sh/install | bash
```

Clone the repo and install dependencies:

```sh
git clone https://github.com/dqian/casino-cli.git
cd casino-cli
bun i
```

Run:

```sh
bun run src/index.ts
```

## Alias

For quick access, add this to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```sh
alias casino='bun run ~/casino-cli/src/index.ts'
```

Then just run:

```sh
casino
```
