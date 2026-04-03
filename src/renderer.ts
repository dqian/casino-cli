import type { AppState, MenuItem } from "./types";
import * as t from "./theme";
import { renderRouletteScreen, renderHotkeyGrid } from "./roulette/renderer";

export const MENU_ITEMS: MenuItem[] = [
  { name: "Roulette", screen: "roulette", label: "European (Single Zero)" },
  { name: "Blackjack", screen: null, label: "Coming Soon" },
  { name: "Craps", screen: null, label: "Coming Soon" },
];

export function renderScreen(state: AppState): void {
  if (state.screen === "roulette") {
    renderGameScreen(state);
    return;
  }
  renderMenuScreen(state);
}

function renderMenuScreen(state: AppState): void {
  const { columns: width, rows: height } = process.stdout;
  const lines: string[] = [];

  // ASCII art title
  const title = [
    `  ${t.yellow}${t.bold} ██████╗ █████╗ ███████╗██╗███╗   ██╗ ██████╗ ${t.reset}`,
    `  ${t.yellow}${t.bold}██╔════╝██╔══██╗██╔════╝██║████╗  ██║██╔═══██╗${t.reset}`,
    `  ${t.yellow}${t.bold}██║     ███████║███████╗██║██╔██╗ ██║██║   ██║${t.reset}`,
    `  ${t.yellow}${t.bold}██║     ██╔══██║╚════██║██║██║╚██╗██║██║   ██║${t.reset}`,
    `  ${t.yellow}${t.bold}╚██████╗██║  ██║███████║██║██║ ╚████║╚██████╔╝${t.reset}`,
    `  ${t.yellow}${t.bold} ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ${t.reset}`,
  ];

  // Center title vertically
  const menuHeight = title.length + 2 + MENU_ITEMS.length * 2 + 4;
  const topPad = Math.max(1, Math.floor((height - menuHeight) / 2));

  for (let i = 0; i < topPad; i++) lines.push("");

  // Title
  for (const line of title) {
    lines.push(centerAnsiText(line, width));
  }
  lines.push("");

  // Balance
  const balanceLine = `${t.green}${t.bold}Balance: $${state.balance.toLocaleString()}${t.reset}`;
  lines.push(centerAnsiText(balanceLine, width));
  lines.push("");
  lines.push(centerAnsiText(`${t.gray}${"─".repeat(40)}${t.reset}`, width));
  lines.push("");

  // Menu items
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i]!;
    const selected = i === state.menuCursor;
    const available = item.screen !== null;

    let line: string;
    if (selected && available) {
      line = `${t.cyan}${t.bold}  > ${item.name}${t.reset}  ${t.gray}${item.label}${t.reset}`;
    } else if (selected && !available) {
      line = `${t.gray}  > ${item.name}  ${t.dim}${item.label}${t.reset}`;
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
    { key: "q", label: "Quit" },
  ];
  const maxKey = Math.max(...menuKeys.map(h => h.key.length));
  const maxLabel = Math.max(...menuKeys.map(h => h.label.length));
  const cellW = maxKey + 2 + maxLabel + 2;
  const cols = Math.max(1, Math.floor(40 / cellW));
  const hotkeyRows = Math.ceil(menuKeys.length / cols);
  for (let r = 0; r < hotkeyRows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= menuKeys.length) break;
      const h = menuKeys[idx]!;
      line += `${t.white}${t.bold}${h.key.padStart(maxKey)}${t.reset}  ${t.gray}${h.label.padEnd(maxLabel)}${t.reset}    `;
    }
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
  const lines = renderRouletteScreen(state);

  // Render hotkey grid at bottom
  const hotkeyLines = renderHotkeyGrid(width, state.roulette.phase);
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
  const out = [t.cursorHome];
  for (let i = 0; i < totalRows; i++) {
    out.push(t.eraseLine);
    out.push(lines[i] ?? "");
    if (i < totalRows - 1) out.push("\n");
  }
  process.stdout.write(out.join(""));
}

function centerAnsiText(text: string, width: number): string {
  const visLen = t.stripAnsi(text).length;
  const pad = Math.max(0, Math.floor((width - visLen) / 2));
  return " ".repeat(pad) + text;
}
