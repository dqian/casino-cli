import type { AppState, CrapsBet, CrapsBetKind, CrapsState } from "../types";
import * as t from "../theme";
import { renderHeader, renderHotkeySplit, type HotkeyItem } from "../shared/render";
import { BET_POSITIONS, totalBets, isBetAvailable, placePayoutStr } from "./game";

// --- Dice rendering ---

// Each die face is 5 lines tall, 11 chars wide (including borders)
const DICE_FACES: Record<number, string[]> = {
  1: [
    "\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "\u2502         \u2502",
    "\u2502    \u25cf    \u2502",
    "\u2502         \u2502",
    "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
  ],
  2: [
    "\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "\u2502  \u25cf      \u2502",
    "\u2502         \u2502",
    "\u2502      \u25cf  \u2502",
    "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
  ],
  3: [
    "\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "\u2502  \u25cf      \u2502",
    "\u2502    \u25cf    \u2502",
    "\u2502      \u25cf  \u2502",
    "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
  ],
  4: [
    "\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "\u2502  \u25cf   \u25cf  \u2502",
    "\u2502         \u2502",
    "\u2502  \u25cf   \u25cf  \u2502",
    "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
  ],
  5: [
    "\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "\u2502  \u25cf   \u25cf  \u2502",
    "\u2502    \u25cf    \u2502",
    "\u2502  \u25cf   \u25cf  \u2502",
    "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
  ],
  6: [
    "\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "\u2502  \u25cf   \u25cf  \u2502",
    "\u2502  \u25cf   \u25cf  \u2502",
    "\u2502  \u25cf   \u25cf  \u2502",
    "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
  ],
};

// Tumbling animation frames — show randomized dot patterns
const TUMBLE_FRAMES: string[][] = [
  [
    "\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e",
    "\u2502  \u25cb   \u25cb  \u2502",
    "\u2502         \u2502",
    "\u2502  \u25cb   \u25cb  \u2502",
    "\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f",
  ],
  [
    "\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "\u2502  \u25e6      \u2502",
    "\u2502    \u25e6    \u2502",
    "\u2502      \u25e6  \u2502",
    "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
  ],
  [
    "\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e",
    "\u2502  \u25cb   \u25cb  \u2502",
    "\u2502    \u25cb    \u2502",
    "\u2502  \u25cb   \u25cb  \u2502",
    "\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f",
  ],
];

function renderDie(value: number, color: string): string[] {
  const face = DICE_FACES[value] ?? DICE_FACES[1]!;
  return face.map(line => `${color}${t.bold}${line}${t.reset}`);
}

function renderTumblingDie(frame: number, color: string): string[] {
  const tumble = TUMBLE_FRAMES[frame % TUMBLE_FRAMES.length]!;
  return tumble.map(line => `${color}${line}${t.reset}`);
}

function renderDicePair(d1: number, d2: number, rolling: boolean, frame: number): string[] {
  const lines: string[] = [];
  const gap = "   ";

  if (rolling) {
    const die1 = renderTumblingDie(frame, t.white);
    const die2 = renderTumblingDie(frame + 1, t.white);
    for (let i = 0; i < 5; i++) {
      lines.push(die1[i]! + gap + die2[i]!);
    }
  } else {
    const die1 = renderDie(d1, t.brightWhite);
    const die2 = renderDie(d2, t.brightWhite);
    for (let i = 0; i < 5; i++) {
      lines.push(die1[i]! + gap + die2[i]!);
    }
  }

  return lines;
}

// --- Point puck ---

function renderPuck(point: number | null): string {
  if (point === null) {
    return `${t.bg256(235)}${t.white}${t.bold} OFF ${t.reset}`;
  }
  return `${t.bg256(15)}${t.black}${t.bold} ON ${point} ${t.reset}`;
}

// --- Bet table rendering ---

const CHIP = "\u25cf";

function chipColor(amount: number): string {
  if (amount >= 500) return t.fg256(210);
  if (amount >= 100) return t.fg256(216);
  if (amount >= 50)  return t.fg256(228);
  if (amount >= 25)  return t.fg256(156);
  if (amount >= 10)  return t.fg256(123);
  if (amount >= 5)   return t.fg256(111);
  return t.fg256(183);
}

function findBet(bets: CrapsBet[], kind: CrapsBetKind): CrapsBet | null {
  return bets.find(b => b.kind === kind && !b.point) ?? null;
}

function findPointedBets(bets: CrapsBet[], kind: "come" | "dontCome"): CrapsBet[] {
  return bets.filter(b => b.kind === kind && b.point !== undefined && b.point !== null);
}

function renderBetCell(
  label: string,
  bet: CrapsBet | null,
  isCursor: boolean,
  available: boolean,
  width: number,
): string {
  const padLabel = label.length > width - 2 ? label.slice(0, width - 2) : label;
  const leftPad = Math.floor((width - padLabel.length) / 2);
  const rightPad = width - padLabel.length - leftPad;

  if (isCursor && bet) {
    const cc = chipColor(bet.amount);
    return `${t.yellow}${t.bold}${" ".repeat(leftPad)}${padLabel}${t.reset} ${cc}${CHIP}${t.reset}${" ".repeat(Math.max(0, rightPad - 2))}`;
  }
  if (isCursor) {
    return `${t.yellow}${t.bold}${" ".repeat(leftPad)}${padLabel}${" ".repeat(rightPad)}${t.reset}`;
  }
  if (bet) {
    const cc = chipColor(bet.amount);
    return `${t.brightWhite}${t.bold}${" ".repeat(leftPad)}${padLabel}${t.reset} ${cc}${CHIP}${t.reset}${" ".repeat(Math.max(0, rightPad - 2))}`;
  }
  if (!available) {
    return `${t.gray}${t.dim}${" ".repeat(leftPad)}${padLabel}${" ".repeat(rightPad)}${t.reset}`;
  }
  return `${t.gray}${" ".repeat(leftPad)}${padLabel}${" ".repeat(rightPad)}${t.reset}`;
}

// --- Main screen render ---

export function renderCrapsScreen(state: AppState): string[] {
  const { columns: width } = process.stdout;
  const lines: string[] = [];
  const cs = state.craps;

  // Header
  const rightContent = `${t.gray}Chip: $${cs.betAmount}${t.reset}  `;
  lines.push(...renderHeader("CRAPS", state.balance, width, rightContent));

  // Point puck + phase indicator
  const puck = renderPuck(cs.point);
  const phaseLabel = cs.point === null
    ? `${t.cyan}${t.bold}COME-OUT ROLL${t.reset}`
    : `${t.yellow}${t.bold}POINT PHASE${t.reset}`;
  lines.push(`  ${puck}  ${phaseLabel}`);
  lines.push("");

  // Dice area
  const isRolling = cs.phase === "rolling";
  const diceLines = renderDicePair(cs.dice[0], cs.dice[1], isRolling, cs.rollFrame);
  const diceWidth = 11 + 3 + 11; // two dice + gap
  const dicePad = Math.max(2, Math.floor((width - diceWidth) / 2));

  for (const dl of diceLines) {
    lines.push(" ".repeat(dicePad) + dl);
  }

  // Sum display
  if (cs.phase === "rolling") {
    lines.push("");
  } else {
    const sum = cs.dice[0] + cs.dice[1];
    const sumColor = sumIsGood(sum, cs.point) ? t.green : sumIsBad(sum, cs.point) ? t.red : t.white;
    if (cs.phase === "result" || cs.rollHistory.length > 0) {
      const sumPad = " ".repeat(dicePad + Math.floor(diceWidth / 2) - 1);
      lines.push(`${sumPad}${sumColor}${t.bold}${sum}${t.reset}`);
    } else {
      lines.push("");
    }
  }

  // Result message
  if (cs.phase === "result") {
    const resultLine = formatResultLine(cs);
    lines.push(`  ${resultLine}`);
  } else if (cs.phase === "rolling") {
    lines.push(`  ${t.yellow}Rolling...${t.reset}`);
  } else {
    // Betting phase
    const total = totalBets(state);
    if (state.message) {
      lines.push(`  ${t.yellow}${state.message}${t.reset}`);
    } else if (total > 0) {
      lines.push(`  ${t.gray}Table: $${total.toLocaleString()}${t.reset}`);
    } else {
      lines.push(`  ${t.gray}Place your bets!${t.reset}`);
    }
  }
  lines.push("");

  // --- Bet layout table ---
  const tableLines = renderBetTable(cs, width);
  lines.push(...tableLines);

  // Roll history
  lines.push("");
  if (cs.rollHistory.length > 0) {
    const histLine = renderRollHistory(cs.rollHistory, width);
    lines.push(histLine);
  } else {
    lines.push("");
  }

  // Active come/don't come points
  const comePts = findPointedBets(cs.bets, "come");
  const dcomePts = findPointedBets(cs.bets, "dontCome");
  if (comePts.length > 0 || dcomePts.length > 0) {
    let ptLine = "  ";
    if (comePts.length > 0) {
      ptLine += `${t.gray}Come pts: ${t.reset}`;
      ptLine += comePts.map(b =>
        `${t.green}${t.bold}${b.point}${t.reset}${t.gray}($${b.amount})${t.reset}`
      ).join(" ");
      ptLine += "  ";
    }
    if (dcomePts.length > 0) {
      ptLine += `${t.gray}DC pts: ${t.reset}`;
      ptLine += dcomePts.map(b =>
        `${t.red}${t.bold}${b.point}${t.reset}${t.gray}($${b.amount})${t.reset}`
      ).join(" ");
    }
    lines.push(ptLine);
  } else {
    lines.push("");
  }

  return lines;
}

function renderBetTable(cs: CrapsState, width: number): string[] {
  const lines: string[] = [];
  const pad = "  ";
  const cellW = 14;
  const vl = `${t.gray}\u2502${t.reset}`;
  const hl = (n: number) => `${t.gray}${"\u2500".repeat(n)}${t.reset}`;
  const xj = `${t.gray}\u253c${t.reset}`;
  const tl = `${t.gray}\u250c${t.reset}`;
  const tr = `${t.gray}\u2510${t.reset}`;
  const bl = `${t.gray}\u2514${t.reset}`;
  const br = `${t.gray}\u2518${t.reset}`;
  const tj = `${t.gray}\u252c${t.reset}`;
  const bj = `${t.gray}\u2534${t.reset}`;
  const lj = `${t.gray}\u251c${t.reset}`;
  const rj = `${t.gray}\u2524${t.reset}`;

  const isBetting = cs.phase === "betting";

  // Row 1: Pass Line | Don't Pass | Field
  // Row 2: Come | Don't Come | (empty)
  // Row 3: Place 4 | Place 5 | Place 6
  // Row 4: Place 8 | Place 9 | Place 10

  const rows: { kind: CrapsBetKind; label: string; sub?: string }[][] = [
    [
      { kind: "pass", label: "PASS LINE" },
      { kind: "dontPass", label: "DON'T PASS" },
      { kind: "field", label: "FIELD" },
    ],
    [
      { kind: "come", label: "COME" },
      { kind: "dontCome", label: "DON'T COME" },
    ],
    [
      { kind: "place4", label: "PLACE 4", sub: placePayoutStr(4) },
      { kind: "place5", label: "PLACE 5", sub: placePayoutStr(5) },
      { kind: "place6", label: "PLACE 6", sub: placePayoutStr(6) },
    ],
    [
      { kind: "place8", label: "PLACE 8", sub: placePayoutStr(8) },
      { kind: "place9", label: "PLACE 9", sub: placePayoutStr(9) },
      { kind: "place10", label: "PLACE 10", sub: placePayoutStr(10) },
    ],
  ];

  // Top border
  lines.push(pad + tl + hl(cellW) + tj + hl(cellW) + tj + hl(cellW) + tr);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    let contentLine = pad + vl;

    for (let c = 0; c < 3; c++) {
      const cell = row[c];
      if (cell) {
        const posIdx = BET_POSITIONS.findIndex(bp => bp.kind === cell.kind);
        const isCur = isBetting && cs.cursorPos === posIdx;
        const bet = findBet(cs.bets, cell.kind);
        const avail = isBetAvailable(cell.kind, cs.point);
        contentLine += renderBetCell(cell.label, bet, isCur, avail, cellW);
      } else {
        contentLine += " ".repeat(cellW);
      }
      contentLine += vl;
    }
    lines.push(contentLine);

    // Sub-label line (payout info for place bets)
    if (r >= 2) {
      let subLine = pad + vl;
      for (let c = 0; c < 3; c++) {
        const cell = row[c];
        if (cell?.sub) {
          const subText = cell.sub;
          const subPad = Math.floor((cellW - subText.length) / 2);
          subLine += `${" ".repeat(subPad)}${t.gray}${t.dim}${subText}${t.reset}${" ".repeat(cellW - subPad - subText.length)}`;
        } else {
          subLine += " ".repeat(cellW);
        }
        subLine += vl;
      }
      lines.push(subLine);
    }

    // Border between rows
    if (r < rows.length - 1) {
      lines.push(pad + lj + hl(cellW) + xj + hl(cellW) + xj + hl(cellW) + rj);
    }
  }

  // Bottom border
  lines.push(pad + bl + hl(cellW) + bj + hl(cellW) + bj + hl(cellW) + br);

  // Bet amount indicators below table
  const posIdx = cs.cursorPos;
  const pos = BET_POSITIONS[posIdx];
  if (pos && isBetting) {
    const bet = findBet(cs.bets, pos.kind);
    const avail = isBetAvailable(pos.kind, cs.point);
    let infoLine = `${pad}${t.white}${t.bold}${pos.label}${t.reset}`;
    if (!avail) {
      infoLine += `  ${t.gray}${t.dim}(not available on come-out)${t.reset}`;
    } else if (bet) {
      infoLine += `  ${t.gray}Bet: $${bet.amount}${t.reset}`;
    }
    // Add payout info for some bets
    const payoutInfo = getBetPayoutInfo(pos.kind);
    if (payoutInfo) {
      infoLine += `  ${t.gray}${t.dim}${payoutInfo}${t.reset}`;
    }
    lines.push(infoLine);
  } else {
    lines.push("");
  }

  return lines;
}

function getBetPayoutInfo(kind: CrapsBetKind): string {
  switch (kind) {
    case "pass":
    case "dontPass":
    case "come":
    case "dontCome":
      return "Pays 1:1";
    case "field":
      return "2 pays 2:1, 12 pays 3:1, rest 1:1";
    case "place4":
    case "place10":
      return "Pays 9:5";
    case "place5":
    case "place9":
      return "Pays 7:5";
    case "place6":
    case "place8":
      return "Pays 7:6";
  }
  return "";
}

function formatResultLine(cs: CrapsState): string {
  const parts: string[] = [];

  if (cs.winAmount > 0) {
    parts.push(`${t.green}${t.bold}Win $${cs.winAmount.toLocaleString()}${t.reset}`);
  }
  if (cs.lossAmount > 0) {
    parts.push(`${t.red}Lost $${cs.lossAmount.toLocaleString()}${t.reset}`);
  }

  if (cs.message) {
    parts.push(`${t.white}${cs.message}${t.reset}`);
  }

  if (parts.length === 0) {
    return `${t.gray}No action${t.reset}`;
  }

  return parts.join("  ");
}

function sumIsGood(sum: number, point: number | null): boolean {
  if (point === null) return sum === 7 || sum === 11;
  return sum === point;
}

function sumIsBad(sum: number, point: number | null): boolean {
  if (point === null) return sum === 2 || sum === 3 || sum === 12;
  return sum === 7;
}

function renderRollHistory(history: number[], width: number): string {
  const maxShow = Math.min(history.length, Math.floor((width - 16) / 4));
  const recent = history.slice(-maxShow);
  let line = `  ${t.gray}History:${t.reset} `;
  for (const sum of recent) {
    const color = [7, 11].includes(sum) ? t.green
      : [2, 3, 12].includes(sum) ? t.red
      : t.white;
    line += `${color}${t.bold}${String(sum).padStart(2)}${t.reset} `;
  }
  return line;
}

// --- Hotkey grid ---

const HOTKEYS_BETTING: HotkeyItem[] = [
  { key: "\u2190\u2191\u2193\u2192", label: "Move" },
  { key: "Space", label: "Place bet" },
  { key: "Enter", label: "Roll" },
  { key: "+/-", label: "Chip size" },
  { key: "x", label: "Remove bet" },
  { key: "c", label: "Clear bets" },
];

const HOTKEYS_BETTING_RIGHT: HotkeyItem[] = [
  { key: "q", label: "Menu" },
];

const HOTKEYS_RESULT: HotkeyItem[] = [
  { key: "Enter", label: "Continue" },
];

const HOTKEYS_RESULT_RIGHT: HotkeyItem[] = [
  { key: "q", label: "Menu" },
];

export function renderCrapsHotkeys(width: number, state: AppState): string[] {
  const cs = state.craps;
  if (cs.phase === "rolling") return [""];

  if (cs.phase === "result") {
    return renderHotkeySplit(HOTKEYS_RESULT, HOTKEYS_RESULT_RIGHT, width);
  }

  return renderHotkeySplit(HOTKEYS_BETTING, HOTKEYS_BETTING_RIGHT, width);
}
