import type { AppState, MenuItem } from "./types";
import * as t from "./theme";
import { renderRouletteScreen, renderHotkeyGrid } from "./roulette/renderer";
import { renderBlackjackScreen, renderBjHotkeyGrid } from "./blackjack/renderer";

export const MENU_ITEMS: MenuItem[] = [
  { name: "Roulette", screen: "roulette", label: "European (Single Zero)" },
  { name: "Blackjack", screen: "blackjack", label: "2-Deck, 3:2" },
  { name: "Baccarat", screen: null, label: "Coming Soon" },
  { name: "Craps", screen: null, label: "Coming Soon" },
];

export function renderScreen(state: AppState): void {
  if (state.screen === "roulette" || state.screen === "blackjack") {
    renderGameScreen(state);
    return;
  }
  renderMenuScreen(state);
}

function renderMenuScreen(state: AppState): void {
  const { columns: width, rows: height } = process.stdout;
  const lines: string[] = [];

  // ASCII art title (raw, no ANSI)
  const titleRaw = [
    "  ██████╗ █████╗ ███████╗██╗███╗   ██╗ ██████╗ ",
    " ██╔════╝██╔══██╗██╔════╝██║████╗  ██║██╔═══██╗",
    " ██║     ███████║███████╗██║██╔██╗ ██║██║   ██║",
    " ██║     ██╔══██║╚════██║██║██║╚██╗██║██║   ██║",
    " ╚██████╗██║  ██║███████║██║██║ ╚████║╚██████╔╝",
    "  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ",
  ];
  const titleW = titleRaw[0]!.length;

  // Shimmer: ~0.25s sweep across ~50 chars every ~6s
  // menuAnimFrame ticks at 25ms intervals
  const shimmerCycle = 250; // frames per full cycle (~6.25s)
  const shimmerSweep = 10;  // frames for the sweep (~0.25s)
  const shimmerFrame = state.menuAnimFrame % shimmerCycle;
  const shimmerActive = shimmerFrame < shimmerSweep;
  const shimmerProgress = shimmerActive ? shimmerFrame / (shimmerSweep - 1) : -1;
  const shimmerCol = shimmerActive ? Math.floor(shimmerProgress * titleW) : -1;
  const shimmerWidth = 6; // chars wide the white highlight is

  // Center title vertically
  const menuHeight = titleRaw.length + 2 + MENU_ITEMS.length * 2 + 4;
  const topPad = Math.max(1, Math.floor((height - menuHeight) / 2));

  for (let i = 0; i < topPad; i++) lines.push("");

  // Title with shimmer
  for (const row of titleRaw) {
    let colored = "";
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]!;
      if (ch === " " || ch === " ") {
        colored += ch;
      } else if (shimmerActive && c >= shimmerCol - shimmerWidth && c <= shimmerCol + shimmerWidth) {
        const dist = Math.abs(c - shimmerCol);
        if (dist <= 2) {
          colored += `${t.brightWhite}${t.bold}${ch}${t.reset}`;
        } else {
          colored += `${t.white}${t.bold}${ch}${t.reset}`;
        }
      } else {
        colored += `${t.yellow}${t.bold}${ch}${t.reset}`;
      }
    }
    lines.push(centerAnsiText(colored, width));
  }
  lines.push("");

  // Mode indicator + Balance
  const modeLabel = state.moneyMode === "play"
    ? `${t.cyan}${t.bold}PLAY MONEY${t.reset}`
    : `${t.yellow}${t.bold}REAL MONEY${t.reset}`;
  lines.push(centerAnsiText(modeLabel, width));
  const balanceLine = `${t.white}${t.bold}Balance: ${t.green}$${state.balance.toLocaleString()}${t.reset}`;
  lines.push(centerAnsiText(balanceLine, width));
  if (state.moneyMode === "real" && state.balance === 0) {
    lines.push(centerAnsiText(`${t.gray}Deposit to start playing${t.reset}`, width));
  } else {
    lines.push("");
  }
  lines.push(centerAnsiText(`${t.gray}${"─".repeat(40)}${t.reset}`, width));
  lines.push("");

  // Menu items
  const cursorChars = ["─", ">", "─", ">"];
  const cursorIdx = Math.floor(state.menuAnimFrame / 6) % cursorChars.length; // ~150ms per frame
  const cursor = cursorChars[cursorIdx]!;
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i]!;
    const selected = i === state.menuCursor;
    const available = item.screen !== null;

    let line: string;
    if (selected && available) {
      line = `${t.cyan}${t.bold}  ${cursor} ${item.name}${t.reset}  ${t.gray}${item.label}${t.reset}`;
    } else if (selected && !available) {
      line = `${t.gray}  ${cursor} ${item.name}  ${t.dim}${item.label}${t.reset}`;
    } else if (!available) {
      line = `${t.gray}${t.dim}    ${item.name}  ${item.label}${t.reset}`;
    } else {
      line = `${t.white}    ${item.name}${t.reset}  ${t.gray}${item.label}${t.reset}`;
    }
    const menuIndent = Math.max(4, Math.floor((width - 48) / 2));
    lines.push(" ".repeat(menuIndent) + "    " + line);
    if (i < MENU_ITEMS.length - 1) lines.push("");
  }

  lines.push("");
  lines.push(centerAnsiText(`${t.gray}${"─".repeat(40)}${t.reset}`, width));
  lines.push("");

  // Hotkey grid as bottom border to menu options
  const menuKeys: { key: string; label: string }[] = [
    { key: "↑↓", label: "Select" },
    { key: "Enter", label: "Play" },
    { key: "m", label: "Toggle mode" },
    ...(state.moneyMode === "play"
      ? [{ key: "r", label: "Reset balance" }]
      : [{ key: "d", label: "Deposit" }]),
    { key: "q", label: "Quit" },
  ];
  const maxKey = Math.max(...menuKeys.map(h => h.key.length));
  const maxLabel = "Reset balance".length; // fixed width to prevent layout shift
  for (const h of menuKeys) {
    const line = `${t.white}${t.bold}${h.key.padStart(maxKey)}${t.reset}  ${t.gray}${h.label.padEnd(maxLabel)}${t.reset}`;
    lines.push(centerAnsiText(line, width));
  }

  if (state.message) {
    lines.push("");
    lines.push(centerAnsiText(`${t.yellow}${state.message}${t.reset}`, width));
  }

  // Fill remaining
  while (lines.length < height) lines.push("");

  // Write to screen
  writeLines(lines, height);
}

function renderGameScreen(state: AppState): void {
  const { columns: width, rows: height } = process.stdout;

  let lines: string[];
  let hotkeyLines: string[];

  if (state.screen === "blackjack") {
    lines = renderBlackjackScreen(state);
    hotkeyLines = renderBjHotkeyGrid(width, state);
  } else {
    lines = renderRouletteScreen(state);
    hotkeyLines = renderHotkeyGrid(width, state.roulette.phase);
  }
  const hotkeyHeight = hotkeyLines.length + 1; // +1 for separator

  // Fill space between content and hotkeys
  while (lines.length < height - hotkeyHeight) lines.push("");

  // Separator + hotkeys
  lines.push(`  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`);
  lines.push(...hotkeyLines);

  // Trim to terminal height
  while (lines.length < height) lines.push("");

  writeLines(lines, height);
}

function writeLines(lines: string[], totalRows: number): void {
  const { columns: width } = process.stdout;
  const out = [t.cursorHome];
  for (let i = 0; i < totalRows; i++) {
    const line = lines[i] ?? "";
    const visLen = t.stripAnsi(line).length;
    // Pad to full width to overwrite previous content (no eraseLine flicker)
    out.push(line + " ".repeat(Math.max(0, width - visLen)));
    if (i < totalRows - 1) out.push("\n");
  }
  process.stdout.write(out.join(""));
}

function centerAnsiText(text: string, width: number): string {
  const visLen = t.stripAnsi(text).length;
  const pad = Math.max(0, Math.floor((width - visLen) / 2));
  return " ".repeat(pad) + text;
}
