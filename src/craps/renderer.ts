import type { AppState, CrapsBet, CrapsBetKind, CrapsState } from "../types";
import * as t from "../theme";
import { renderHeader, renderHotkeySplit, type HotkeyItem } from "../shared/render";
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
// Total inner width is defined by the place bet row: 6 cells + 5 dividers.
// PLACE_W = 12, so inner = 6*12 + 5 = 77
// All other rows must add up to 77 between outer borders.

const PLACE_W = 12;
const INNER_W = 6 * PLACE_W + 5;  // 77

// Row structure widths (must total INNER_W):
// Field:     77
// Come:      38 + 1 + 38 = 77
// Row3:      19 + 1 + 10 + 1 + 10 + 1 + 10 + 1 + 10 + 1 + 13 = 77
// Row4:      19 + 1 + 43 + 1 + 13 = 77

const FIELD_W = INNER_W;       // 77
const COME_W = 38;             // 38 + 1 + 38 = 77
const LEFT_W = 19;             // Don't Pass / Pass Line
const HARD_W = 10;             // each hardway cell
const PROP_W = 13;             // proposition panel
const MIDDLE_W = INNER_W - LEFT_W - 1 - PROP_W - 1;  // 77 - 19 - 1 - 13 - 1 = 43

function renderBetTable(cs: CrapsState, _width: number): string[] {
  const lines: string[] = [];
  const pad = "  ";
  const isBetting = cs.phase === "betting";

  const isCur = (idx: number) => isBetting && cs.cursorPos === idx;
  const posIdx = (kind: CrapsBetKind): number => BET_POSITIONS.findIndex(bp => bp.kind === kind);

  // ===== ROW 0: Place Bets (6 across top) =====
  {
    // Top border
    let border = pad + gjunc(TL);
    for (let i = 0; i < 6; i++) {
      border += hline(PLACE_W);
      border += gjunc(i < 5 ? TJ : TR);
    }
    lines.push(border);

    // Content row
    const placeKinds: CrapsBetKind[] = ["place4", "place5", "place6", "place8", "place9", "place10"];
    const placeNums = [4, 5, 6, 8, 9, 10];
    let row = pad + gvl();
    for (let i = 0; i < 6; i++) {
      const kind = placeKinds[i]!;
      const bet = findBet(cs.bets, kind);
      const idx = posIdx(kind);
      row += renderCell(`PLACE ${placeNums[i]}`, bet, isCur(idx), true, PLACE_W);
      row += gvl();
    }
    lines.push(row);

    // Payout row
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

  // ===== ROW 1: Field (full width) =====
  {
    // Border: merge place cells into single field cell
    let border = pad + gjunc(LJ);
    for (let i = 0; i < 6; i++) {
      border += hline(PLACE_W);
      border += gjunc(i < 5 ? BJ : RJ);
    }
    lines.push(border);

    // Field content
    const fieldBet = findBet(cs.bets, "field");
    const fieldIdx = posIdx("field");
    const fieldLabel = "FIELD  2, 3, 4, 9, 10, 11, 12";
    let fieldLine = pad + gvl();
    fieldLine += renderCell(fieldLabel, fieldBet, isCur(fieldIdx), true, FIELD_W);
    fieldLine += gvl();
    lines.push(fieldLine);

    // Field sub
    const fieldSub = "2 pays 2:1  \u00b7  12 pays 3:1";
    let subLine = pad + gvl();
    const fslp = Math.floor((FIELD_W - fieldSub.length) / 2);
    const fsrp = FIELD_W - fieldSub.length - fslp;
    subLine += `${spc(fslp)}${t.gray}${t.dim}${fieldSub}${t.reset}${spc(fsrp)}`;
    subLine += gvl();
    lines.push(subLine);
  }

  // ===== ROW 2: Don't Come | Come =====
  {
    lines.push(pad + gjunc(LJ) + hline(COME_W) + gjunc(TJ) + hline(COME_W) + gjunc(RJ));

    const dcBet = findBet(cs.bets, "dontCome");
    const dcIdx = posIdx("dontCome");
    const comeBet = findBet(cs.bets, "come");
    const comeIdx = posIdx("come");
    let row = pad + gvl();
    row += renderCell("DON'T COME", dcBet, isCur(dcIdx), isBetAvailable("dontCome", cs.point), COME_W);
    row += gvl();
    row += renderCell("COME", comeBet, isCur(comeIdx), isBetAvailable("come", cs.point), COME_W);
    row += gvl();
    lines.push(row);
  }

  // ===== ROW 3: Don't Pass | Hard 4 | Hard 6 | Hard 8 | Hard 10 | Props header =====
  // Row3 inner = LEFT_W + 1 + HARD_W*4 + 3 + 1 + PROP_W
  // = 19 + 1 + 40 + 3 + 1 + 13 = 77. OK.
  {
    lines.push(pad + gjunc(LJ) + hline(LEFT_W) + gjunc(TJ) +
      hline(HARD_W) + gjunc(TJ) + hline(HARD_W) + gjunc(TJ) +
      hline(HARD_W) + gjunc(TJ) + hline(HARD_W) + gjunc(TJ) +
      hline(PROP_W) + gjunc(RJ));

    const dpBet = findBet(cs.bets, "dontPass");
    const dpOdds = findOddsBet(cs.bets, "dontPassOdds");
    const dpIdx = posIdx("dontPass");
    const hardKinds: CrapsBetKind[] = ["hard4", "hard6", "hard8", "hard10"];
    const hardLabels = ["Hard 4", "Hard 6", "Hard 8", "Hard 10"];
    const hardPays = ["7:1", "9:1", "9:1", "7:1"];

    let row = pad + gvl();
    row += renderCell("DON'T PASS", dpBet, isCur(dpIdx), true, LEFT_W, undefined, dpOdds);
    row += gvl();
    for (let i = 0; i < 4; i++) {
      const hBet = findBet(cs.bets, hardKinds[i]!);
      const hIdx = posIdx(hardKinds[i]!);
      row += renderCell(hardLabels[i]!, hBet, isCur(hIdx), true, HARD_W);
      row += gvl();
    }
    row += renderCell("PROPOSITIONS", null, false, true, PROP_W, t.white);
    row += gvl();
    lines.push(row);

    // Hardway payouts sub
    let subRow = pad + gvl();
    subRow += spc(LEFT_W);
    subRow += gvl();
    for (let i = 0; i < 4; i++) {
      const ps = hardPays[i]!;
      const lp = Math.floor((HARD_W - ps.length) / 2);
      const rp = HARD_W - ps.length - lp;
      subRow += `${spc(lp)}${t.gray}${t.dim}${ps}${t.reset}${spc(rp)}`;
      subRow += gvl();
    }
    subRow += renderCell("Single-Roll", null, false, true, PROP_W, `${t.gray}${t.dim}`);
    subRow += gvl();
    lines.push(subRow);
  }

  // ===== ROW 4: Pass Line | Odds | Prop bets =====
  // Row4 inner = LEFT_W + 1 + MIDDLE_W + 1 + PROP_W = 19 + 1 + 43 + 1 + 13 = 77
  // But the border above needs to merge the 4 hardway cells into MIDDLE_W.
  // 4*HARD_W + 3 = 43 = MIDDLE_W. Perfect.
  {
    lines.push(pad + gjunc(LJ) + hline(LEFT_W) + gjunc(XJ) +
      hline(HARD_W) + gjunc(BJ) + hline(HARD_W) + gjunc(BJ) +
      hline(HARD_W) + gjunc(BJ) + hline(HARD_W) + gjunc(XJ) +
      hline(PROP_W) + gjunc(RJ));

    const passBet = findBet(cs.bets, "pass");
    const passOdds = findOddsBet(cs.bets, "passOdds");
    const passIdx = posIdx("pass");

    // Line 1: Pass Line | Odds | Any7 + AnyCraps
    let row1 = pad + gvl();
    row1 += renderCell("PASS LINE", passBet, isCur(passIdx), true, LEFT_W, undefined, passOdds);
    row1 += gvl();

    const oddsLabel = buildOddsLabel(cs);
    const oddsVis = t.stripAnsi(oddsLabel).length;
    const oddsLp = Math.floor((MIDDLE_W - oddsVis) / 2);
    const oddsRp = MIDDLE_W - oddsVis - oddsLp;
    row1 += spc(oddsLp) + oddsLabel + spc(oddsRp);
    row1 += gvl();

    // Props: 2 per sub-row in the prop panel
    const propHalf = Math.floor(PROP_W / 2);
    const propRest = PROP_W - propHalf;
    const any7Bet = findBet(cs.bets, "any7");
    const any7Idx = posIdx("any7");
    const acBet = findBet(cs.bets, "anyCraps");
    const acIdx = posIdx("anyCraps");
    row1 += renderPropPair("Any7", any7Bet, isCur(any7Idx), "ACraps", acBet, isCur(acIdx), propHalf, propRest);
    row1 += gvl();
    lines.push(row1);

    // Line 2: sub text | odds info | Yo + Horn
    let row2 = pad + gvl();
    const passSubLabel = cs.point !== null && passBet ? "Press 'o' for odds" : "";
    const psLp = Math.floor((LEFT_W - passSubLabel.length) / 2);
    const psRp = LEFT_W - passSubLabel.length - psLp;
    row2 += `${spc(psLp)}${t.gray}${t.dim}${passSubLabel}${t.reset}${spc(psRp)}`;
    row2 += gvl();

    const oddsInfo = cs.point !== null ? "3-4-5x Odds" : "";
    const oiLp = Math.floor((MIDDLE_W - oddsInfo.length) / 2);
    const oiRp = MIDDLE_W - oddsInfo.length - oiLp;
    row2 += `${spc(oiLp)}${t.gray}${t.dim}${oddsInfo}${t.reset}${spc(oiRp)}`;
    row2 += gvl();

    const yoBet = findBet(cs.bets, "yo");
    const yoIdx = posIdx("yo");
    const hornBet = findBet(cs.bets, "horn");
    const hornIdx = posIdx("horn");
    row2 += renderPropPair("Yo-11", yoBet, isCur(yoIdx), "Horn", hornBet, isCur(hornIdx), propHalf, propRest);
    row2 += gvl();
    lines.push(row2);

    // Line 3: empty | empty | C&E centered
    let row3 = pad + gvl();
    row3 += spc(LEFT_W);
    row3 += gvl();
    row3 += spc(MIDDLE_W);
    row3 += gvl();
    const ceBet = findBet(cs.bets, "ce");
    const ceIdx = posIdx("ce");
    row3 += renderCell("C & E", ceBet, isCur(ceIdx), true, PROP_W);
    row3 += gvl();
    lines.push(row3);
  }

  // ===== Bottom border =====
  lines.push(pad + gjunc(BL) + hline(LEFT_W) + gjunc(BJ) +
    hline(MIDDLE_W) + gjunc(BJ) + hline(PROP_W) + gjunc(BR));

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

/** Render two prop bets side by side in the prop panel */
function renderPropPair(
  label1: string, bet1: CrapsBet | null, cur1: boolean,
  label2: string, bet2: CrapsBet | null, cur2: boolean,
  w1: number, w2: number,
): string {
  return renderCell(label1, bet1, cur1, true, w1) + renderCell(label2, bet2, cur2, true, w2);
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
    if (cs.point !== null) {
      return `${t.gray}${t.dim}ODDS${t.reset}`;
    }
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
