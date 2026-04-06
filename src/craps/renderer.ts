import type { AppState, CrapsBet, CrapsBetKind, CrapsState } from "../types";
import * as t from "../theme";
import { renderHeader, renderHotkeySplit, widthWarning, type HotkeyItem } from "../shared/render";
import { BET_POSITIONS, totalBets, isBetAvailable, placePayoutStr, getBetPayoutInfo, canPlaceOdds } from "./game";

// --- Dice rendering ---

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

// --- Chip rendering ---

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

function findOddsBet(bets: CrapsBet[], kind: CrapsBetKind): CrapsBet | null {
  return bets.find(b => b.kind === kind) ?? null;
}

// --- Box drawing helpers ---

const HL = "\u2500";
const VL = "\u2502";
const TL = "\u250c";
const TR = "\u2510";
const BL = "\u2514";
const BR = "\u2518";
const TJ = "\u252c";
const BJ = "\u2534";
const LJ = "\u251c";
const RJ = "\u2524";
const XJ = "\u253c";

function spc(n: number): string { return n > 0 ? " ".repeat(n) : ""; }
function hline(n: number): string { return `${t.gray}${HL.repeat(n)}${t.reset}`; }
function gvl(): string { return `${t.gray}${VL}${t.reset}`; }
function gjunc(ch: string): string { return `${t.gray}${ch}${t.reset}`; }

// --- Cell rendering ---

function renderCell(
  label: string,
  bet: CrapsBet | null,
  isCursor: boolean,
  available: boolean,
  width: number,
  labelColor?: string,
  oddsBet?: CrapsBet | null,
): string {
  const padLabel = label.length > width - 2 ? label.slice(0, width - 2) : label;
  const leftPad = Math.floor((width - padLabel.length) / 2);
  const rightPad = width - padLabel.length - leftPad;

  const oddsStr = oddsBet ? ` ${t.cyan}+O${t.reset}` : "";
  const oddsVisLen = oddsBet ? 3 : 0;

  if (isCursor && bet) {
    const cc = chipColor(bet.amount);
    const used = padLabel.length + 2 + oddsVisLen;
    const rp = Math.max(0, width - leftPad - used);
    return `${spc(leftPad)}${t.yellow}${t.bold}${padLabel}${t.reset} ${cc}${CHIP}${t.reset}${oddsStr}${spc(rp)}`;
  }
  if (isCursor) {
    return `${spc(leftPad)}${t.yellow}${t.bold}${padLabel}${t.reset}${oddsStr}${spc(Math.max(0, rightPad - oddsVisLen))}`;
  }
  if (bet) {
    const cc = chipColor(bet.amount);
    const used = padLabel.length + 2 + oddsVisLen;
    const rp = Math.max(0, width - leftPad - used);
    const lc = labelColor || t.brightWhite;
    return `${spc(leftPad)}${lc}${t.bold}${padLabel}${t.reset} ${cc}${CHIP}${t.reset}${oddsStr}${spc(rp)}`;
  }
  if (!available) {
    return `${t.gray}${t.dim}${spc(leftPad)}${padLabel}${spc(rightPad)}${t.reset}`;
  }
  const lc = labelColor || t.gray;
  return `${lc}${spc(leftPad)}${padLabel}${spc(rightPad)}${t.reset}`;
}

// --- Table layout ---
// Main board (left):
//   Place row:  6*PLACE_W + 5 = 77
//   DC+Come:    DC_W + 1 + COME_W = 77
//   Full rows:  INNER_W = 77
// Side panel (right):
//   2-col: SIDE_HALF + 1 + SIDE_HALF = 29
//   3-col: SIDE_THIRD + 1 + SIDE_THIRD + 1 + SIDE_THIRD = 29

const PLACE_W = 12;
const INNER_W = 6 * PLACE_W + 5;         // 77
const DC_W = PLACE_W;                    // 12 (aligns with first place cell)
const COME_W = INNER_W - DC_W - 1;       // 64
const SIDE_INNER = 29;                    // side panel inner width
const SIDE_HALF = 14;                     // 14+1+14 = 29
const SIDE_THIRD = 9;                     // 9+1+9+1+9 = 29
const SIDE_GAP = 2;
const MAIN_VIS_W = 2 + 1 + INNER_W + 1;  // 81 (pad + borders)
const CRAPS_MIN_WIDTH = MAIN_VIS_W + SIDE_GAP + SIDE_INNER + 2; // 114

function renderBetTable(cs: CrapsState, _width: number): string[] {
  const lines: string[] = [];
  const pad = "  ";
  const isBetting = cs.phase === "betting";

  const isCur = (idx: number) => isBetting && cs.cursorPos === idx;
  const posIdx = (kind: CrapsBetKind): number => BET_POSITIONS.findIndex(bp => bp.kind === kind);

  // ===== Header row above place numbers (segmented) =====
  {
    let border = pad + gjunc(TL);
    for (let i = 0; i < 6; i++) {
      border += hline(PLACE_W);
      border += gjunc(i < 5 ? TJ : TR);
    }
    lines.push(border);

    let row = pad + gvl();
    for (let i = 0; i < 6; i++) {
      row += spc(PLACE_W) + gvl();
    }
    lines.push(row);
  }

  // ===== Place Numbers (6 across) =====
  {
    let border = pad + gjunc(LJ);
    for (let i = 0; i < 6; i++) {
      border += hline(PLACE_W);
      border += gjunc(i < 5 ? XJ : RJ);
    }
    lines.push(border);

    const placeKinds: CrapsBetKind[] = ["place4", "place5", "place6", "place8", "place9", "place10"];
    const placeLabels = ["4", "5", "SIX", "8", "NINE", "10"];
    const placeNums = [4, 5, 6, 8, 9, 10];
    let row = pad + gvl();
    for (let i = 0; i < 6; i++) {
      const kind = placeKinds[i]!;
      const bet = findBet(cs.bets, kind);
      const idx = posIdx(kind);
      const labelColor = (placeLabels[i] === "SIX" || placeLabels[i] === "NINE") ? t.red : undefined;
      row += renderCell(placeLabels[i]!, bet, isCur(idx), true, PLACE_W, labelColor);
      row += gvl();
    }
    lines.push(row);

    // Extra height row
    let emptyRow = pad + gvl();
    for (let i = 0; i < 6; i++) {
      emptyRow += spc(PLACE_W) + gvl();
    }
    lines.push(emptyRow);

    let payRow = pad + gvl();
    for (let i = 0; i < 6; i++) {
      const ps = placePayoutStr(placeNums[i]!);
      const lp = Math.floor((PLACE_W - ps.length) / 2);
      const rp = PLACE_W - ps.length - lp;
      payRow += `${spc(lp)}${t.gray}${t.dim}${ps}${t.reset}${spc(rp)}`;
      payRow += gvl();
    }
    lines.push(payRow);
  }

  // ===== ROW 1: Don't Come (left) | Come (right), 2 lines tall =====
  {
    // Border: first place cell aligns with DC, remaining 5 merge into COME
    let border = pad + gjunc(LJ) + hline(PLACE_W) + gjunc(XJ);
    for (let i = 1; i < 6; i++) {
      border += hline(PLACE_W);
      border += gjunc(i < 5 ? BJ : RJ);
    }
    lines.push(border);

    const dcBet = findBet(cs.bets, "dontCome");
    const dcIdx = posIdx("dontCome");
    const dcAvail = isBetAvailable("dontCome", cs.point);
    const comeBet = findBet(cs.bets, "come");
    const comeIdx = posIdx("come");
    const comeAvail = isBetAvailable("come", cs.point);

    // Line 1: "DONT" in DC cell | empty in Come cell
    let row1 = pad + gvl();
    row1 += renderCell("DONT", dcBet, isCur(dcIdx), dcAvail, DC_W);
    row1 += gvl();
    row1 += spc(COME_W);
    row1 += gvl();
    lines.push(row1);

    // Line 2: "COME" in DC cell | "COME" in Come cell
    let row2 = pad + gvl();
    row2 += renderCell("COME", null, isCur(dcIdx), dcAvail, DC_W);
    row2 += gvl();
    row2 += renderCell("COME", comeBet, isCur(comeIdx), comeAvail, COME_W);
    row2 += gvl();
    lines.push(row2);
  }

  // ===== ROW 2: Field (full width) =====
  {
    lines.push(pad + gjunc(LJ) + hline(DC_W) + gjunc(BJ) + hline(COME_W) + gjunc(RJ));

    const fieldBet = findBet(cs.bets, "field");
    const fieldIdx = posIdx("field");
    const fieldLabel = "FIELD   2 \u00b7 3 \u00b7 4 \u00b7 9 \u00b7 10 \u00b7 11 \u00b7 12";
    let row = pad + gvl();
    row += renderCell(fieldLabel, fieldBet, isCur(fieldIdx), true, INNER_W);
    row += gvl();
    lines.push(row);

    const fieldSub = "2 pays 2:1  \u00b7  12 pays 3:1";
    let subRow = pad + gvl();
    const fslp = Math.floor((INNER_W - fieldSub.length) / 2);
    const fsrp = INNER_W - fieldSub.length - fslp;
    subRow += `${spc(fslp)}${t.gray}${t.dim}${fieldSub}${t.reset}${spc(fsrp)}`;
    subRow += gvl();
    lines.push(subRow);
  }

  // ===== ROW 3: Don't Pass (full width) =====
  {
    lines.push(pad + gjunc(LJ) + hline(INNER_W) + gjunc(RJ));

    const dpBet = findBet(cs.bets, "dontPass");
    const dpOdds = findOddsBet(cs.bets, "dontPassOdds");
    const dpIdx = posIdx("dontPass");
    let row = pad + gvl();
    row += renderCell("DON'T PASS", dpBet, isCur(dpIdx), true, INNER_W, undefined, dpOdds);
    row += gvl();
    lines.push(row);
  }

  // ===== ROW 4: Pass Line (full width) =====
  {
    lines.push(pad + gjunc(LJ) + hline(INNER_W) + gjunc(RJ));

    const passBet = findBet(cs.bets, "pass");
    const passOdds = findOddsBet(cs.bets, "passOdds");
    const passIdx = posIdx("pass");
    let row = pad + gvl();
    row += renderCell("PASS LINE", passBet, isCur(passIdx), true, INNER_W, undefined, passOdds);
    row += gvl();
    lines.push(row);
  }

  // Main table bottom border
  lines.push(pad + gjunc(BL) + hline(INNER_W) + gjunc(BR));

  // Odds info line (or empty padding)
  const oddsLabel = buildOddsLabel(cs);
  lines.push(oddsLabel ? pad + oddsLabel : "");

  // ===== SIDE PANEL (right side) =====
  const mainLines = lines.splice(0); // move main board lines out
  const sideLines: string[] = [];

  // Any 7 (full width)
  {
    sideLines.push(gjunc(TL) + hline(SIDE_INNER) + gjunc(TR));
    const a7Bet = findBet(cs.bets, "any7");
    const a7Idx = posIdx("any7");
    let row = gvl();
    row += renderCell("4:1 SEVEN 4:1", a7Bet, isCur(a7Idx), true, SIDE_INNER);
    row += gvl();
    sideLines.push(row);
  }

  // Hard 6 | Hard 10 (2-col)
  {
    sideLines.push(gjunc(LJ) + hline(SIDE_HALF) + gjunc(TJ) + hline(SIDE_HALF) + gjunc(RJ));
    const pairs: [CrapsBetKind, string, string][] = [
      ["hard6", "Hard 6", "9:1"],
      ["hard10", "Hard 10", "7:1"],
    ];
    let row = gvl();
    for (const [kind, label] of pairs) {
      row += renderCell(label, findBet(cs.bets, kind), isCur(posIdx(kind)), true, SIDE_HALF);
      row += gvl();
    }
    sideLines.push(row);
    let sub = gvl();
    for (const [, , pay] of pairs) {
      const lp = Math.floor((SIDE_HALF - pay.length) / 2);
      sub += `${spc(lp)}${t.gray}${t.dim}${pay}${t.reset}${spc(SIDE_HALF - pay.length - lp)}`;
      sub += gvl();
    }
    sideLines.push(sub);
  }

  // Hard 8 | Hard 4 (2-col)
  {
    sideLines.push(gjunc(LJ) + hline(SIDE_HALF) + gjunc(XJ) + hline(SIDE_HALF) + gjunc(RJ));
    const pairs: [CrapsBetKind, string, string][] = [
      ["hard8", "Hard 8", "9:1"],
      ["hard4", "Hard 4", "7:1"],
    ];
    let row = gvl();
    for (const [kind, label] of pairs) {
      row += renderCell(label, findBet(cs.bets, kind), isCur(posIdx(kind)), true, SIDE_HALF);
      row += gvl();
    }
    sideLines.push(row);
    let sub = gvl();
    for (const [, , pay] of pairs) {
      const lp = Math.floor((SIDE_HALF - pay.length) / 2);
      sub += `${spc(lp)}${t.gray}${t.dim}${pay}${t.reset}${spc(SIDE_HALF - pay.length - lp)}`;
      sub += gvl();
    }
    sideLines.push(sub);
  }

  // Ace-Deuce | Aces | Twelve (3-col, transition from 2-col)
  {
    // 2-col divider at 14, 3-col dividers at 9 and 19
    sideLines.push(gjunc(LJ) +
      hline(SIDE_THIRD) + gjunc(TJ) +
      hline(SIDE_HALF - SIDE_THIRD - 1) + gjunc(BJ) +
      hline(SIDE_HALF - SIDE_THIRD - 1) + gjunc(TJ) +
      hline(SIDE_THIRD) + gjunc(RJ));

    const props: [CrapsBetKind, string][] = [
      ["aceDeuce", "3"],
      ["aces", "2"],
      ["twelve", "12"],
    ];
    let row = gvl();
    for (const [kind, label] of props) {
      row += renderCell(label, findBet(cs.bets, kind), isCur(posIdx(kind)), true, SIDE_THIRD);
      row += gvl();
    }
    sideLines.push(row);
    const payouts = ["15:1", "30:1", "30:1"];
    let sub = gvl();
    for (const pay of payouts) {
      const lp = Math.floor((SIDE_THIRD - pay.length) / 2);
      sub += `${spc(lp)}${t.gray}${t.dim}${pay}${t.reset}${spc(SIDE_THIRD - pay.length - lp)}`;
      sub += gvl();
    }
    sideLines.push(sub);
  }

  // Yo-11 | Horn | C & E (3-col)
  {
    sideLines.push(gjunc(LJ) +
      hline(SIDE_THIRD) + gjunc(XJ) +
      hline(SIDE_THIRD) + gjunc(XJ) +
      hline(SIDE_THIRD) + gjunc(RJ));

    const props: [CrapsBetKind, string][] = [
      ["yo", "Yo-11"],
      ["horn", "Horn"],
      ["ce", "C & E"],
    ];
    let row = gvl();
    for (const [kind, label] of props) {
      row += renderCell(label, findBet(cs.bets, kind), isCur(posIdx(kind)), true, SIDE_THIRD);
      row += gvl();
    }
    sideLines.push(row);
  }

  // Any Craps (full width)
  {
    sideLines.push(gjunc(LJ) +
      hline(SIDE_THIRD) + gjunc(BJ) +
      hline(SIDE_THIRD) + gjunc(BJ) +
      hline(SIDE_THIRD) + gjunc(RJ));
    const acBet = findBet(cs.bets, "anyCraps");
    const acIdx = posIdx("anyCraps");
    let row = gvl();
    row += renderCell("ANY CRAPS 7:1", acBet, isCur(acIdx), true, SIDE_INNER);
    row += gvl();
    sideLines.push(row);
  }

  // Side panel bottom border
  sideLines.push(gjunc(BL) + hline(SIDE_INNER) + gjunc(BR));

  // ===== COMBINE HORIZONTALLY =====
  const maxRows = Math.max(mainLines.length, sideLines.length);
  for (let i = 0; i < maxRows; i++) {
    const mLine = mainLines[i] ?? "";
    const sLine = sideLines[i] ?? "";
    const mVis = t.stripAnsi(mLine).length;
    const padNeeded = Math.max(0, MAIN_VIS_W - mVis);
    lines.push(mLine + spc(padNeeded + SIDE_GAP) + sLine);
  }

  // ===== Info line =====
  const curPos = BET_POSITIONS[cs.cursorPos];
  if (curPos && isBetting) {
    const bet = findBet(cs.bets, curPos.kind);
    const avail = isBetAvailable(curPos.kind, cs.point);
    let infoLine = `${pad}${t.white}${t.bold}${curPos.label}${t.reset}`;
    if (!avail) {
      infoLine += `  ${t.gray}${t.dim}(not available)${t.reset}`;
    } else if (bet) {
      infoLine += `  ${t.gray}Bet: $${bet.amount}${t.reset}`;
    }
    const payoutInfo = getBetPayoutInfo(curPos.kind);
    if (payoutInfo) {
      infoLine += `  ${t.gray}${t.dim}${payoutInfo}${t.reset}`;
    }
    if (canPlaceOdds(cs)) {
      infoLine += `  ${t.cyan}${t.bold}[o] Odds${t.reset}`;
    }
    lines.push(infoLine);
  } else {
    lines.push("");
  }

  return lines;
}

function buildOddsLabel(cs: CrapsState): string {
  const parts: string[] = [];

  const passOdds = findOddsBet(cs.bets, "passOdds");
  if (passOdds) {
    parts.push(`${t.green}Pass Odds: $${passOdds.amount}${t.reset}`);
  }

  const dpOdds = findOddsBet(cs.bets, "dontPassOdds");
  if (dpOdds) {
    parts.push(`${t.red}DP Odds: $${dpOdds.amount}${t.reset}`);
  }

  const comeOddsBets = cs.bets.filter(b => b.kind === "comeOdds");
  for (const co of comeOddsBets) {
    parts.push(`${t.green}Come(${co.point}) Odds: $${co.amount}${t.reset}`);
  }

  const dcOddsBets = cs.bets.filter(b => b.kind === "dontComeOdds");
  for (const dco of dcOddsBets) {
    parts.push(`${t.red}DC(${dco.point}) Odds: $${dco.amount}${t.reset}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return parts.join("  ");
}

// --- Main screen render ---

export function renderCrapsScreen(state: AppState): string[] {
  const { columns: width } = process.stdout;
  const lines: string[] = [];
  const cs = state.craps;

  // Header
  const rightContent = `${t.gray}Chip: $${cs.betAmount}${t.reset}  `;
  lines.push(...renderHeader("CRAPS", state.balance, width, rightContent));

  // Width warning
  const warn = widthWarning(width, CRAPS_MIN_WIDTH);
  if (warn) lines.push(warn);

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
  const diceWidth = 11 + 3 + 11;
  const dicePad = Math.max(2, Math.floor((width - diceWidth) / 2));

  for (const dl of diceLines) {
    lines.push(spc(dicePad) + dl);
  }

  // Sum display
  if (cs.phase === "rolling") {
    lines.push("");
  } else {
    const sum = cs.dice[0] + cs.dice[1];
    const sumColor = sumIsGood(sum, cs.point) ? t.green : sumIsBad(sum, cs.point) ? t.red : t.white;
    if (cs.phase === "result" || cs.rollHistory.length > 0) {
      const sumPad = spc(dicePad + Math.floor(diceWidth / 2) - 1);
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

  // Bet table
  lines.push(...renderBetTable(cs, width));

  // Roll history
  lines.push("");
  if (cs.rollHistory.length > 0) {
    lines.push(renderRollHistory(cs.rollHistory, width));
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
      ptLine += comePts.map(b => {
        const odds = cs.bets.find(ob => ob.kind === "comeOdds" && ob.point === b.point);
        const oddsStr = odds ? `${t.cyan}+$${odds.amount}${t.reset}` : "";
        return `${t.green}${t.bold}${b.point}${t.reset}${t.gray}($${b.amount})${t.reset}${oddsStr}`;
      }).join(" ");
      ptLine += "  ";
    }
    if (dcomePts.length > 0) {
      ptLine += `${t.gray}DC pts: ${t.reset}`;
      ptLine += dcomePts.map(b => {
        const odds = cs.bets.find(ob => ob.kind === "dontComeOdds" && ob.point === b.point);
        const oddsStr = odds ? `${t.cyan}+$${odds.amount}${t.reset}` : "";
        return `${t.red}${t.bold}${b.point}${t.reset}${t.gray}($${b.amount})${t.reset}${oddsStr}`;
      }).join(" ");
    }
    lines.push(ptLine);
  } else {
    lines.push("");
  }

  return lines;
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
  { key: "o", label: "Odds bet" },
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
