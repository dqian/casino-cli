import type { AppState, BetType } from "../types";
import * as t from "../theme";
import { centerAnsi } from "../shared/render";
import { renderHeader } from "../shared/render";
import {
  numberColor, numberAt, sameBetType, WHEEL_ORDER, betLabel,
  virtualToGridPos, gridPosToBet, payout,
  NUM_TABLE_ROWS, NUM_TABLE_COLS, VGRID_COLS,
} from "./board";
import { totalBets } from "./game";

const CELL_W = 8;
const DOZEN_W = 9;
const GUTTER_W = 4; // left gutter for street/sixline

const DOT = "·";
const CROSS = "+";
const CHIP = "●";
const VLINE = "│";
const TJUNC = "┤";
const LJUNC = "├";
const XJUNC = "┼";
const CORNER_TL = "╭";
const CORNER_TR = "╮";
const CORNER_BL = "╰";
const CORNER_BR = "╯";
const TJUNC_T = "┬";
const BJUNC = "┴";
const HLINE = "─";
const HLINE_H = "━";
const VLINE_H = "┃";
const LJUNC_H = "┝";   // vertical light, right heavy (left edge of heavy bottom border)
const XJUNC_H = "┿";   // vertical light, horizontal heavy (interior of heavy bottom border)
const TJUNC_DH = "╁";  // down heavy, up + horizontal light (top of dozen left)
const LJUNC_VH = "┨";  // vertical heavy, left light (non-boundary dozen left)
const XJUNC_VH = "╂";  // vertical heavy, horizontal light (boundary dozen left)
const XJUNC_DLH = "╃"; // down heavy, left heavy, up + right light (bottom grid-dozen corner)

function hlineFill(n: number, color: string = t.gray): string {
  if (n <= 0) return "";
  return `${color}${HLINE.repeat(n)}${t.reset}`;
}

function hlineFillHeavy(n: number, color: string = t.gray): string {
  if (n <= 0) return "";
  return `${color}${HLINE_H.repeat(n)}${t.reset}`;
}

function chipColor(amount: number): string {
  if (amount >= 500) return t.fg256(210); // bright coral/red
  if (amount >= 100) return t.fg256(216); // bright orange
  if (amount >= 50)  return t.fg256(228); // bright yellow
  if (amount >= 25)  return t.fg256(156); // bright green
  if (amount >= 10)  return t.fg256(123); // bright cyan
  if (amount >= 5)   return t.fg256(111); // bright blue
  return t.fg256(183); // lavender
}

function dotFill(n: number, color: string = t.gray): string {
  if (n <= 0) return "";
  return `${color}${DOT.repeat(n)}${t.reset}`;
}

function dotFillWithChip(n: number, dotColor: string, chipColorStr: string): string {
  if (n <= 0) return "";
  const mid = Math.floor(n / 2);
  return `${dotColor}${DOT.repeat(mid)}${t.reset}${chipColorStr}${CHIP}${t.reset}${dotColor}${DOT.repeat(n - mid - 1)}${t.reset}`;
}

function hlineFillWithChip(n: number, lineColor: string, chipColorStr: string): string {
  if (n <= 0) return "";
  const mid = Math.floor(n / 2);
  return `${lineColor}${HLINE.repeat(mid)}${t.reset}${chipColorStr}${CHIP}${t.reset}${lineColor}${HLINE.repeat(n - mid - 1)}${t.reset}`;
}

const HIST_W = 6; // " XX " + 2 spaces

// --- Hotkey grid (rendered at terminal bottom) ---
const HOTKEYS: { key: string; label: string }[] = [
  { key: "←↑↓→", label: "Move" },
  { key: "Space", label: "Place bet" },
  { key: "c", label: "Clear all" },
  { key: "Enter", label: "Spin" },
  { key: "+/-", label: "Chip size" },
  { key: "x", label: "Remove bet" },
  { key: "w", label: "Wheel mode" },
  { key: "q", label: "Menu" },
];

const HOTKEYS_RESULT: { key: string; label: string }[] = [
  { key: "Enter", label: "New round" },
  { key: "q", label: "Menu" },
];

export function renderHotkeyGrid(width: number, phase: string): string[] {
  const keys = phase === "result" ? HOTKEYS_RESULT : phase === "spinning" ? [] : HOTKEYS;
  if (keys.length === 0) return [""];

  const maxKey = Math.max(...keys.map(h => h.key.length));
  const maxLabel = Math.max(...keys.map(h => h.label.length));
  const cellW = maxKey + 2 + maxLabel + 2;
  const cols = Math.max(1, Math.floor((width - 4) / cellW));
  const rows = Math.ceil(keys.length / cols);

  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "  ";
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= keys.length) break;
      const h = keys[idx]!;
      line += `${t.white}${t.bold}${h.key.padStart(maxKey)}${t.reset}  ${t.gray}${h.label.padEnd(maxLabel)}${t.reset}  `;
    }
    lines.push(line);
  }
  return lines;
}

export function renderRouletteScreen(state: AppState): string[] {
  const { columns: width } = process.stdout;
  const lines: string[] = [];
  const rs = state.roulette;

  // Header
  const modeIcon = rs.wheelMode === "ball" ? "Ball" : "Arrow";
  const rightContent = `${t.gray}${modeIcon} | Chip: $${rs.betAmount}${t.reset}  `;
  lines.push(...renderHeader("ROULETTE", state.balance, width, rightContent));

  // Wheel / status area — pointer char depends on ball mode
  const useBall = rs.wheelMode === "ball";
  let pointerChar = "▼";
  if (useBall) {
    if (rs.phase === "spinning") {
      pointerChar = rs.ballBouncing ? " " : "●";
    } else if (rs.phase === "result") {
      pointerChar = "●";
    }
  }

  // Ball bounce area — directly above the wheel strip.
  // In ball mode: 6 rows (absorbs the pointer line). Otherwise: 5 empty + pointer via renderWheel.
  const showBall = rs.wheelMode === "ball" && rs.phase === "spinning" && rs.ballRow <= 5;
  if (showBall) {
    const wheelCenter = Math.floor(width / 2);
    for (let row = 0; row < 6; row++) {
      if (row === rs.ballRow) {
        const col = Math.max(0, Math.min(width - 1, wheelCenter + Math.round(rs.ballCol)));
        lines.push(" ".repeat(col) + `${t.brightWhite}${t.bold}●${t.reset}`);
      } else {
        lines.push("");
      }
    }
  } else {
    lines.push("", "", "", "", "");
  }
  if (rs.phase === "spinning") {
    const wheelLines = renderWheel(rs.spinHighlight, width, rs.spinHalfStep, pointerChar);
    if (showBall) {
      // Ball area already includes the pointer row — only push the wheel strip
      lines.push(wheelLines[1] ?? "");
    } else {
      lines.push(...wheelLines);
    }
    lines.push(centerAnsi(`${t.yellow}Spinning...${t.reset}`, width));
    lines.push("");
  } else if (rs.phase === "result") {
    lines.push(...renderWheel(rs.spinHighlight, width, false, pointerChar));
    if (rs.winAmount > 0) {
      lines.push(centerAnsi(`${t.green}${t.bold}WIN $${rs.winAmount.toLocaleString()}!${t.reset}`, width));
    } else {
      lines.push(centerAnsi(`${t.red}No win${t.reset}`, width));
    }
    lines.push("");
  } else {
    // Betting phase
    if (rs.result !== null) {
      lines.push(...renderWheel(rs.result, width));
    } else {
      lines.push(""); // pointer placeholder
      lines.push(centerAnsi("Place your bets!", width));
    }
    const total = totalBets(state);
    lines.push(total > 0 ? centerAnsi(`${t.gray}Table: $${total.toLocaleString()}${t.reset}`, width) : "");
    lines.push(state.message ? centerAnsi(`${t.yellow}${state.message}${t.reset}`, width) : "");
  }

  // Current bet info line — left-aligned to board, bet amount right-aligned
  if (rs.phase === "betting") {
    const cursorBet = getCursorBet(rs);
    if (cursorBet) {
      const label = betLabel(cursorBet);
      const payoutVal = payout(cursorBet);
      const existing = rs.bets.find(b => sameBetType(b.type, cursorBet));

      const gridInner = CELL_W * NUM_TABLE_COLS + (NUM_TABLE_COLS - 1);
      const numRowW = GUTTER_W + 1 + gridInner + 1 + DOZEN_W + 1;
      const boardLeft = Math.max(HIST_W + 2, Math.floor((width - numRowW) / 2) + 2);
      const boardPad = " ".repeat(boardLeft + GUTTER_W);

      // Right edge aligns with top-right corner of zero box
      const zeroBoxW = 1 + gridInner + 1; // crosses + inner
      const leftText = `${t.white}${t.bold}${label}${t.reset} ${t.gray}(${payoutVal}:1)${t.reset}`;
      if (existing) {
        const rightText = `${t.gray}Bet: $${existing.amount}${t.reset}`;
        const leftVis = t.stripAnsi(leftText).length;
        const rightVis = t.stripAnsi(rightText).length;
        const gap = Math.max(1, zeroBoxW - leftVis - rightVis);
        lines.push(boardPad + leftText + spc(gap) + rightText);
      } else {
        lines.push(boardPad + leftText);
      }
    } else {
      lines.push("");
    }
  } else {
    lines.push("");
  }

  // Board
  const boardLines = renderBoard(state, width);
  lines.push(...boardLines);

  return lines;
}

function getCursorBet(rs: AppState["roulette"]): BetType | null {
  switch (rs.cursorZone) {
    case "zero": return { kind: "straight", number: 0 };
    case "grid": return gridPosToBet(virtualToGridPos(rs.cursorVR, rs.cursorVC));
    case "column": {
      const which = (rs.cursorVC + 1) as 1 | 2 | 3;
      return { kind: "column", which };
    }
    case "dozen": {
      const which = (rs.cursorVC + 1) as 1 | 2 | 3;
      return { kind: "dozen", which };
    }
    case "outside": {
      if (rs.cursorVR === 0) {
        const types: BetType[] = [{ kind: "red" }, { kind: "black" }, { kind: "low" }];
        return types[rs.cursorVC] ?? null;
      }
      const types: BetType[] = [{ kind: "even" }, { kind: "odd" }, { kind: "high" }];
      return types[rs.cursorVC] ?? null;
    }
  }
  return null;
}

// Background color shades by distance from center
function wheelBg(color: "red" | "green" | "black", dist: number): string {
  if (color === "red") {
    // Bright red center → dark red edges
    if (dist === 0) return t.bg256(196);  // bright red
    if (dist === 1) return t.bg256(160);  // red
    if (dist === 2) return t.bg256(124);  // dark red
    if (dist === 3) return t.bg256(88);   // darker red
    return t.bg256(52);                    // darkest red
  }
  if (color === "green") {
    if (dist === 0) return t.bg256(34);
    if (dist === 1) return t.bg256(28);
    if (dist === 2) return t.bg256(22);
    return t.bg256(22);
  }
  // black numbers → gray shades
  if (dist === 0) return t.bg256(236);
  if (dist === 1) return t.bg256(235);
  if (dist === 2) return t.bg256(234);
  if (dist === 3) return t.bg256(233);
  return t.bg256(232);
}

function renderWheel(highlight: number, width: number, halfStep: boolean = false, pointerChar: string = "▼"): string[] {
  const idx = WHEEL_ORDER.indexOf(highlight);
  const windowSize = 9;
  const half = Math.floor(windowSize / 2);
  const slotW = 4; // each slot is " XX "

  // Pointer line (fixed position)
  const pointerPad = half * slotW + 1;
  const pointerLine = pointerChar.trim()
    ? centerAnsi(spc(pointerPad) + `${t.gray}${pointerChar}${t.reset}` + spc(pointerPad), width)
    : "";

  if (!halfStep) {
    let wheel = "";
    for (let i = -half; i <= half; i++) {
      const wheelIdx = (idx + i + WHEEL_ORDER.length) % WHEEL_ORDER.length;
      const num = WHEEL_ORDER[wheelIdx] ?? 0;
      const color = numberColor(num);
      const bg = wheelBg(color, Math.abs(i));
      wheel += `${bg}${t.white}${t.bold} ${String(num).padStart(2, " ")} ${t.reset}`;
    }
    return [pointerLine, centerAnsi(wheel, width)];
  }

  // Half-step: shift wheel left by 2 chars. Render windowSize+1 slots,
  // trim 2 chars from left of first slot and 2 from right of last slot.
  let wheel = "";
  for (let i = -half; i <= half + 1; i++) {
    const wheelIdx = (idx + i + WHEEL_ORDER.length) % WHEEL_ORDER.length;
    const num = WHEEL_ORDER[wheelIdx] ?? 0;
    const color = numberColor(num);
    const dist = Math.round(Math.abs(i - 0.5));
    const bg = wheelBg(color, dist);
    const numStr = String(num).padStart(2, " ");
    if (i === -half) {
      // First slot: show only last 2 chars ("X ")
      wheel += `${bg}${t.white}${t.bold}${numStr[1]} ${t.reset}`;
    } else if (i === half + 1) {
      // Last slot: show only first 2 chars (" X")
      wheel += `${bg}${t.white}${t.bold} ${numStr[0]}${t.reset}`;
    } else {
      wheel += `${bg}${t.white}${t.bold} ${numStr} ${t.reset}`;
    }
  }
  return [pointerLine, centerAnsi(wheel, width)];
}

function renderHistEntry(num: number): string {
  const color = numberColor(num);
  const bg = wheelBg(color, 1);
  return `${bg}${t.white}${t.bold} ${String(num).padStart(2)} ${t.reset}`;
}

// --- Board rendering ---

function renderBoard(state: AppState, width: number): string[] {
  const rs = state.roulette;
  const rawLines: string[] = [];

  const gridInner = CELL_W * NUM_TABLE_COLS + (NUM_TABLE_COLS - 1); // 26
  // Dozen column starts at row 1, not zero. Zero row only spans number grid.
  // Board width for number rows: gutter + grid + dozen
  const numRowW = GUTTER_W + 1 + gridInner + 1 + DOZEN_W + 1;
  // Zero row width: gutter + grid only
  const zeroRowW = GUTTER_W + 1 + gridInner + 1;

  const hasHist = rs.spinHistory.length > 0;
  // Center the board itself; history column sits to the left (+2 for visual offset)
  const boardLeft = Math.max(HIST_W + 2, Math.floor((width - numRowW) / 2) + 2);
  const leftPad = boardLeft - HIST_W; // margin before history column
  const pad = " ".repeat(boardLeft); // includes room for history

  const d = `${t.gray}${DOT}${t.reset}`;
  const x = `${t.gray}${CROSS}${t.reset}`;
  const yd = `${t.yellow}${t.bold}${DOT}${t.reset}`;
  const yx = `${t.yellow}${t.bold}${CROSS}${t.reset}`;
  const vl = `${t.gray}${VLINE}${t.reset}`;
  const yvl = `${t.yellow}${t.bold}${VLINE}${t.reset}`;
  const lj = `${t.gray}${LJUNC}${t.reset}`;
  const ylj = `${t.yellow}${t.bold}${LJUNC}${t.reset}`;
  const xj = `${t.gray}${XJUNC}${t.reset}`;
  const tj = `${t.gray}${TJUNC}${t.reset}`;
  const ytj = `${t.yellow}${t.bold}${TJUNC}${t.reset}`;
  const vlh = `${t.gray}${VLINE_H}${t.reset}`;

  // No box highlighting for straight number bets — only split/corner/line bets highlight borders

  // --- Left gutter helpers ---
  function renderGutter(vr: number): string {
    const edgeVC = -1;
    const isCursor = rs.cursorZone === "grid" && rs.cursorVR === vr && rs.cursorVC === edgeVC && rs.phase === "betting";
    const pos = virtualToGridPos(vr, edgeVC);
    const bet = findBet(rs, gridPosToBet(pos));
    const isStreet = vr % 2 === 0;
    const marker = isStreet ? "St" : "6L";

    if (isCursor && bet) {
      const cc = chipColor(bet);
      return `${cc}${CHIP}${t.reset} ${t.white}${t.bold}${marker}${t.reset}`;
    }
    if (isCursor) {
      return `${t.yellow}${t.bold}${CHIP}${t.reset} ${t.white}${t.bold}${marker}${t.reset}`;
    }
    if (bet) {
      const cc = chipColor(bet);
      return `${cc}${CHIP}${t.reset} ${t.white}${t.bold}${marker}${t.reset}`;
    }
    return spc(GUTTER_W);
  }

  // --- Zero row (no dozen column) ---
  const zeroSel = rs.cursorZone === "zero" && rs.phase === "betting";
  const zeroBet = findBet(rs, { kind: "straight", number: 0 });
  // Top border (zero only — no dozen, rounded corners)
  const ctl = `${t.gray}${CORNER_TL}${t.reset}`;
  const ctr = `${t.gray}${CORNER_TR}${t.reset}`;
  rawLines.push(pad + spc(GUTTER_W) + ctl + hlineFill(gridInner) + ctr);
  // Zero content
  const zeroSpinHL = (rs.phase === "spinning" || rs.phase === "result") && rs.spinHighlight === 0;
  rawLines.push(pad + spc(GUTTER_W) + renderZeroCell(gridInner, zeroSel, zeroBet, zeroSpinHL) + vl);

  // Zero-to-grid border + dozen column top
  {
    let zb = pad + spc(GUTTER_W);
    for (let tc = 0; tc < NUM_TABLE_COLS; tc++) {
      const vc = tc * 2;
      const splitCursor = rs.cursorZone === "grid" && rs.cursorVR === -1 && rs.cursorVC === vc && rs.phase === "betting";
      const splitBet = findBet(rs, gridPosToBet(virtualToGridPos(-1, vc)));

      // Junction (or trio chip at tc > 0)
      if (tc === 0) {
        zb += lj;
      } else {
        const trioVC = vc - 1;
        const trioCursor = rs.cursorZone === "grid" && rs.cursorVR === -1 && rs.cursorVC === trioVC && rs.phase === "betting";
        const trioBet = findBet(rs, gridPosToBet(virtualToGridPos(-1, trioVC)));
        if (trioCursor) {
          zb += `${trioBet ? chipColor(trioBet) : `${t.yellow}${t.bold}`}${CHIP}${t.reset}`;
        } else if (trioBet) {
          zb += `${chipColor(trioBet)}${t.bold}${CHIP}${t.reset}`;
        } else {
          zb += `${t.gray}${TJUNC_T}${t.reset}`;
        }
      }

      // Split content
      if (splitCursor) {
        const cc = splitBet ? chipColor(splitBet) : `${t.yellow}${t.bold}`;
        zb += hlineFillWithChip(CELL_W, t.gray, cc);
      } else if (splitBet) {
        zb += hlineFillWithChip(CELL_W, t.gray, `${chipColor(splitBet)}${t.bold}`);
      } else {
        zb += hlineFill(CELL_W);
      }
    }
    zb += `${t.gray}${TJUNC_DH}${t.reset}` + hlineFill(DOZEN_W) + `${t.gray}${CORNER_TR}${t.reset}`;
    rawLines.push(zb);
  }

  // --- Number rows ---
  for (let tr = 1; tr <= NUM_TABLE_ROWS; tr++) {
    const vr = (tr - 1) * 2;
    const dozenIdx = Math.floor((tr - 1) / 4);
    const rowInDozen = (tr - 1) % 4;

    // Content line
    let cl = pad + renderGutter(vr) + vl;

    for (let tc = 0; tc < NUM_TABLE_COLS; tc++) {
      const vc = tc * 2;
      const num = numberAt(tr, tc);
      const color = numberColor(num);
      const isGridCursor = rs.cursorZone === "grid" && rs.cursorVR === vr && rs.cursorVC === vc && rs.phase === "betting";
      const isSpinHL = (rs.phase === "spinning" || rs.phase === "result") && num === rs.spinHighlight;
      const bet = findBet(rs, { kind: "straight", number: num });

      cl += renderNumberCell(num, CELL_W, color, isGridCursor, isSpinHL, bet);

      if (tc < NUM_TABLE_COLS - 1) {
        const sepVC = vc + 1;
        const splitBet = findBet(rs, gridPosToBet(virtualToGridPos(vr, sepVC)));
        const vSplitCursor = rs.cursorZone === "grid" && rs.cursorVR === vr && rs.cursorVC === sepVC && rs.phase === "betting";
        if (vSplitCursor) {
          cl += `${splitBet ? chipColor(splitBet) : `${t.yellow}${t.bold}`}${CHIP}${t.reset}`;
        } else if (splitBet) {
          cl += `${chipColor(splitBet)}${t.bold}${CHIP}${t.reset}`;
        } else {
          cl += vl;
        }
      }
    }
    cl += vlh;
    // Dozen: sequential line index within group (content rows = 0,2,4,6; border rows = 1,3,5)
    const dozenLine = rowInDozen * 2;
    cl += renderDozenContent(rs, dozenIdx, dozenLine, DOZEN_W);
    cl += vl;
    rawLines.push(cl);

    // Border row
    if (tr < NUM_TABLE_ROWS) {
      const vrBorder = vr + 1;
      const isDozenBoundary = tr % 4 === 0;

      let bl = pad + renderGutter(vrBorder) + lj;

      for (let tc = 0; tc < NUM_TABLE_COLS; tc++) {
        const vc = tc * 2;
        const hSplitCursor = rs.cursorZone === "grid" && rs.cursorVR === vrBorder && rs.cursorVC === vc && rs.phase === "betting";
        const splitBet = findBet(rs, gridPosToBet(virtualToGridPos(vrBorder, vc)));
        if (hSplitCursor) {
          const cc = splitBet ? chipColor(splitBet) : `${t.yellow}${t.bold}`;
          bl += hlineFillWithChip(CELL_W, t.gray, cc);
        } else if (splitBet) {
          bl += hlineFillWithChip(CELL_W, t.gray, `${chipColor(splitBet)}${t.bold}`);
        } else {
          bl += hlineFill(CELL_W);
        }

        if (tc < NUM_TABLE_COLS - 1) {
          const cornerVC = vc + 1;
          const cornerCursor = rs.cursorZone === "grid" && rs.cursorVR === vrBorder && rs.cursorVC === cornerVC && rs.phase === "betting";
          const cornerBet = findBet(rs, gridPosToBet(virtualToGridPos(vrBorder, cornerVC)));

          if (cornerCursor) {
            bl += `${cornerBet ? chipColor(cornerBet) : `${t.yellow}${t.bold}`}${CHIP}${t.reset}`;
          } else if (cornerBet) {
            bl += `${chipColor(cornerBet)}${t.bold}${CHIP}${t.reset}`;
          } else {
            bl += xj;
          }
        }
      }

      if (isDozenBoundary) {
        bl += `${t.gray}${XJUNC_VH}${t.reset}`;
        bl += hlineFill(DOZEN_W) + tj;
      } else {
        bl += `${t.gray}${LJUNC_VH}${t.reset}`;
        const dozenBorderLine = rowInDozen * 2 + 1;
        bl += renderDozenContent(rs, dozenIdx, dozenBorderLine, DOZEN_W) + vl;
      }
      rawLines.push(bl);
    }
  }

  // Bottom border of number grid + dozen
  {
    let bb = pad + spc(GUTTER_W);
    for (let tc = 0; tc < NUM_TABLE_COLS; tc++) {
      bb += tc === 0 ? `${t.gray}${LJUNC_H}${t.reset}` : `${t.gray}${XJUNC_H}${t.reset}`;
      bb += hlineFillHeavy(CELL_W);
    }
    bb += `${t.gray}${XJUNC_DLH}${t.reset}` + hlineFill(DOZEN_W) + `${t.gray}${CORNER_BR}${t.reset}`;
    rawLines.push(bb);
  }

  // Column bets (2:1)
  {
    const colCursor = (c: number) => rs.cursorZone === "column" && rs.cursorVC === c && rs.phase === "betting";
    let cl = pad + spc(GUTTER_W) + vl;
    for (let c = 0; c < NUM_TABLE_COLS; c++) {
      const colWhich = (c + 1) as 1 | 2 | 3;
      const isCur = colCursor(c);
      const bet = findBet(rs, { kind: "column", which: colWhich });
      cl += renderLabelCell("2to1", CELL_W, isCur, bet);
      if (c < NUM_TABLE_COLS - 1) cl += vl;
    }
    cl += vl;
    rawLines.push(cl);
  }

  // Helper for 3-col outside border lines with cursor highlight
  function outsideBorder3(): string {
    let line = pad + spc(GUTTER_W);
    for (let c = 0; c < 3; c++) {
      line += c === 0 ? lj : xj;
      line += hlineFill(CELL_W);
    }
    line += tj;
    return line;
  }

  // Border above outside row 0
  rawLines.push(outsideBorder3());

  // Outside bets row 0: RED, BLK, 1-18
  {
    const row: { label: string; bet: BetType; color?: string }[] = [
      { label: "RED", bet: { kind: "red" }, color: t.red },
      { label: "BLK", bet: { kind: "black" } },
      { label: "1-18", bet: { kind: "low" } },
    ];
    const isCur = (i: number) => rs.cursorZone === "outside" && rs.cursorVR === 0 && rs.cursorVC === i && rs.phase === "betting";
    let ol = pad + spc(GUTTER_W) + vl;
    for (let i = 0; i < 3; i++) {
      const ob = row[i]!;
      const bet = findBet(rs, ob.bet);
      ol += renderLabelCell(ob.label, CELL_W, isCur(i), bet, ob.color);
      if (i < 2) ol += vl;
    }
    ol += vl;
    rawLines.push(ol);
  }

  // Border between outside rows
  rawLines.push(outsideBorder3());

  // Outside bets row 1: EVEN, ODD, 19-36
  {
    const row: { label: string; bet: BetType }[] = [
      { label: "EVEN", bet: { kind: "even" } },
      { label: "ODD", bet: { kind: "odd" } },
      { label: "19-36", bet: { kind: "high" } },
    ];
    const isCur = (i: number) => rs.cursorZone === "outside" && rs.cursorVR === 1 && rs.cursorVC === i && rs.phase === "betting";
    let ol = pad + spc(GUTTER_W) + vl;
    for (let i = 0; i < 3; i++) {
      const ob = row[i]!;
      const bet = findBet(rs, ob.bet);
      ol += renderLabelCell(ob.label, CELL_W, isCur(i), bet);
      if (i < 2) ol += vl;
    }
    ol += vl;
    rawLines.push(ol);
  }

  // Bottom border of outside bets
  {
    const cbl = `${t.gray}${CORNER_BL}${t.reset}`;
    const cbr = `${t.gray}${CORNER_BR}${t.reset}`;
    let bb = pad + spc(GUTTER_W);
    for (let c = 0; c < 3; c++) {
      if (c === 0) {
        bb += cbl;
      } else {
        bb += `${t.gray}${BJUNC}${t.reset}`;
      }
      bb += hlineFill(CELL_W);
      if (c === 2) bb += cbr;
    }
    rawLines.push(bb);
  }

  // --- Merge history rail (always present, fills with spaces if no history) ---
  const hist = [...rs.spinHistory].reverse();
  const result: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    let histCol: string;
    if (hasHist && i === 0) {
      // "Hist" label on first line, padded to HIST_W
      histCol = `${t.gray}Hist${t.reset}` + spc(HIST_W - 4);
    } else if (hasHist && i - 1 >= 0 && i - 1 < hist.length) {
      // Entries start on line 1 (scooted down by 1 for the label)
      const entry = renderHistEntry(hist[i - 1]!);
      const visLen = t.stripAnsi(entry).length;
      histCol = entry + spc(HIST_W - visLen);
    } else {
      histCol = spc(HIST_W);
    }
    result.push(spc(leftPad) + histCol + rawLines[i]!.slice(boardLeft));
  }
  return result;
}

// --- Helpers ---

function spc(n: number): string { return " ".repeat(n); }

function findBet(rs: AppState["roulette"], betType: BetType): number | null {
  const bet = rs.bets.find(b => sameBetType(b.type, betType));
  return bet ? bet.amount : null;
}

function renderZeroCell(w: number, isCursor: boolean, betAmount: number | null, isSpinHL: boolean = false): string {
  const d = `${t.gray}${VLINE}${t.reset}`;
  // Use ceil for left pad to shift "0" right by 1 to align with middle column
  const centerZero = (text: string, n: number) => {
    const left = Math.ceil((n - text.length) / 2);
    return spc(left) + text + spc(n - text.length - left);
  };
  if (isSpinHL) {
    return `${d}${wheelBg("green", 0)}${t.white}${t.bold}${centerZero("0", w)}${t.reset}`;
  }
  if (isCursor) {
    const cc = betAmount ? chipColor(betAmount) : `${t.yellow}${t.bold}`;
    const left = Math.ceil((w - 1) / 2);
    return `${d}${spc(left)}${t.yellow}${t.bold}0${t.reset} ${cc}${CHIP}${t.reset}${spc(w - left - 3)}`;
  }
  if (betAmount) {
    const cc = chipColor(betAmount);
    const left = Math.ceil((w - 1) / 2);
    return `${d}${spc(left)}${t.brightGreen}${t.bold}0${t.reset} ${cc}${CHIP}${t.reset}${spc(w - left - 3)}`;
  }
  return `${d}${t.green}${t.bold}${centerZero("0", w)}${t.reset}`;
}

function renderNumberCell(
  num: number, w: number, color: string,
  isCursor: boolean, isSpinHL: boolean, betAmount: number | null,
): string {
  const numStr = String(num).padStart(2, " ");
  const fgColor = color === "red" ? t.brightRed : t.brightWhite;
  const chipRight = (num - 1) % 3 !== 2; // right col → chip left, others → chip right

  if (isCursor) {
    const cc = betAmount ? chipColor(betAmount) : `${t.yellow}${t.bold}`;
    return labelWithChip(`${t.yellow}${t.bold}`, numStr, cc, w, chipRight);
  }
  if (isSpinHL) {
    const bg = wheelBg(color as "red" | "green" | "black", 0);
    return `${bg}${t.white}${t.bold}${centerText(numStr, w)}${t.reset}`;
  }
  if (betAmount) {
    const cc = chipColor(betAmount);
    return labelWithChip(`${fgColor}${t.bold}`, numStr, cc, w, chipRight);
  }
  return `${fgColor}${t.bold}${centerText(numStr, w)}${t.reset}`;
}

function renderLabelCell(
  label: string, w: number, isCursor: boolean, betAmount: number | null, labelColor?: string,
): string {
  if (isCursor) {
    const cc = betAmount ? chipColor(betAmount) : `${t.yellow}${t.bold}`;
    return labelWithChip(`${t.yellow}${t.bold}`, label, cc, w, true);
  }
  if (betAmount) {
    const cc = chipColor(betAmount);
    const lc = labelColor || t.brightWhite;
    return labelWithChip(`${lc}${t.bold}`, label, `${cc}`, w, true);
  }
  const lc = labelColor || t.gray;
  return `${lc}${t.bold}${centerText(label, w)}${t.reset}`;
}

// dozenLine: 0-6 sequential line within the dozen group (content=0,2,4,6 border=1,3,5)
function renderDozenContent(
  rs: AppState["roulette"], dozenIdx: number, dozenLine: number, w: number,
): string {
  const which = (dozenIdx + 1) as 1 | 2 | 3;
  const isCursor = rs.cursorZone === "dozen" && rs.cursorVC === dozenIdx && rs.phase === "betting";
  const bet = findBet(rs, { kind: "dozen", which });
  const labels = ["1st 12", "2nd 12", "3rd 12"];
  const label = labels[dozenIdx]!;

  // Line 3: label
  if (dozenLine === 3) {
    if (isCursor) return `${t.yellow}${t.bold}${centerText(label, w)}${t.reset}`;
    if (bet) return `${t.brightWhite}${t.bold}${centerText(label, w)}${t.reset}`;
    return `${t.gray}${t.bold}${centerText(label, w)}${t.reset}`;
  }
  // Line 4: chip
  if (dozenLine === 4) {
    if (isCursor && bet) {
      const cc = chipColor(bet);
      return centerWithAnsi(`${cc}${CHIP}`, CHIP, w);
    }
    if (isCursor) return centerWithAnsi(`${t.yellow}${t.bold}${CHIP}`, CHIP, w);
    if (bet) {
      const cc = chipColor(bet);
      return centerWithAnsi(`${cc}${CHIP}`, CHIP, w);
    }
    return spc(w);
  }
  // Line 5: empty
  if (dozenLine === 5) {
    return spc(w);
  }
  // Lines 3-6: empty
  return spc(w);
}

function centerText(text: string, w: number): string {
  if (text.length >= w) return text.slice(0, w);
  const left = Math.floor((w - text.length) / 2);
  const right = w - text.length - left;
  return spc(left) + text + spc(right);
}

function centerWithAnsi(ansiText: string, rawText: string, w: number): string {
  const rawLen = rawText.length;
  if (rawLen >= w) return ansiText;
  const left = Math.floor((w - rawLen) / 2);
  const right = w - rawLen - left;
  return spc(left) + ansiText + spc(right);
}

// Place chip next to label without shifting label position
function labelWithChip(
  labelAnsi: string, label: string, chipAnsi: string, w: number, chipRight: boolean,
): string {
  const leftPad = Math.floor((w - label.length) / 2);
  const rightPad = w - label.length - leftPad;
  if (chipRight) {
    return `${spc(leftPad)}${labelAnsi}${label}${t.reset} ${chipAnsi}${CHIP}${t.reset}${spc(Math.max(0, rightPad - 2))}`;
  }
  return `${spc(Math.max(0, leftPad - 2))}${chipAnsi}${CHIP}${t.reset} ${labelAnsi}${label}${t.reset}${spc(rightPad)}`;
}
