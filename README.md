<img width="371" height="138" alt="image" src="https://github.com/user-attachments/assets/d68d13cf-e4f6-421e-a3d7-308c55322bd0" />

# Casino CLI

Terminal-based casino games built with Bun + TypeScript. Zero external dependencies — pure ANSI escape codes for rendering.

## Games

- **Roulette** — European (single zero) with full bet support: straight, split, street, corner, trio, sixline, dozen, column, and outside bets. Features animated wheel spin with bouncing ball physics. Configurable table maximum.
- **Blackjack** — Configurable multi-deck shoe (1/2/4/6/8 decks) with 3:2 payout. Hit, stand, double down, split, and insurance. Auto-reshuffles at a randomized cut card position. Basic strategy hints and Hi-Lo card counting support with running/true count display. Animated card dealing.
- **Pai Gow Poker** — 53-card deck (52 + joker). Deal 7 cards, arrange into a 5-card high hand and 2-card low hand. Full poker hand evaluation with joker wild card handling. House Way auto-arrange for both dealer and player. 5% commission on wins. Animated card spread on deal and sort, 2-color and 4-color suit modes.

## Options

Press `o` from the main menu to configure:

- **Roulette** — Default wheel mode (ball/arrow), table maximum bet
- **Blackjack** — Number of decks in shoe
- **Pai Gow Poker** — Default sort order (ascending/descending), colored suits (4-color/2-color)

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
