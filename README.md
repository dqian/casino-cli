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
bun run start
```

## Running with Environments

The TUI connects to a backend server for user accounts and balance persistence. Use environment-specific scripts to point at the right server:

```sh
bun run dev    # hits localhost:3000 (local server)
bun run prod   # hits production Railway server
bun run start  # no env file, defaults to localhost:3000
```

Environment files:
- `.env.local` — local development (`CASINO_API_URL=http://localhost:3000`)
- `.env.production` — production (`CASINO_API_URL=https://casino-server-production.up.railway.app`)

Update `.env.production` with your actual Railway domain once deployed.

## Local Development (Full Stack)

To run the TUI with auth locally, you need the [casino-server](https://github.com/dqian/casino-server) running. See that repo's README for server setup.

**1. Start Postgres** (one-time, requires Docker)

```sh
docker run -d --name casino-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
```

**2. Start the server**

```sh
cd casino-server
cp .env.example .env   # works as-is, no API keys needed for dev
bun run dev             # starts on localhost:3000 with auto-reload
```

**3. Start the TUI**

```sh
cd casino-cli
bun run dev             # connects to localhost:3000
```

In dev mode, OTP codes print to the server's console output instead of being emailed — just read the code from the server terminal and type it into the TUI.

## User Accounts

Press `l` from the main menu to sign in with email. Signing in saves your play money balance across sessions and devices.

- Enter your email to receive a 6-digit login code
- In dev mode, the code prints to the server console instead of being emailed
- Balance syncs automatically when you exit a game or quit
- Balance resets are throttled to once per 24 hours for signed-in users
- Session is stored at `~/.casino-cli/auth.json`

## Alias

For quick access, add this to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```sh
alias casino='bun run ~/casino-cli/src/index.ts'
```

Then just run:

```sh
casino
```
