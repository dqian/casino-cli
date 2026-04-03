import type { AppState } from "../types";
import * as t from "../theme";
import { numberColor, cellAt, sameBet, WHEEL_ORDER, numberAt } from "./board";
import { totalBets } from "./game";

// Cell dimensions
const CELL_W = 5;
const CELL_H = 3;

export function renderRouletteScreen(state: AppState): string[] {
  const { columns: width } = process.stdout;
  const lines: string[] = [];
  const rs = state.roulette;

  // Header
  const balanceStr = `$${state.balance.toLocaleString()}`;
  const betsStr = totalBets(state) > 0 ? `  Bets: $${totalBets(state).toLocaleString()}` : "";
  const chipStr = `Chip: $${rs.betAmount}`;
  const header = `  ${t.bold}${t.yellow}ROULETTE${t.reset}  ${t.green}${balanceStr}${t.reset}${t.gray}${betsStr}${t.reset}`;
  const headerRight = `${t.gray}${chipStr}${t.reset}  `;
  const headerPad = Math.max(0, width - t.stripAnsi(header).length - t.stripAnsi(headerRight).length);
  lines.push(header + " ".repeat(headerPad) + headerRight);
  lines.push(`  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`);

  // Wheel display during spinning
  if (rs.phase === "spinning" || rs.phase === "result") {
    lines.push("");
    lines.push(renderWheel(rs.spinHighlight, width));
    lines.push("");
  } else {
    lines.push("");
    if (rs.result !== null) {
      lines.push(renderWheel(rs.result, width));
    } else {
      lines.push(centerText("Place your bets!", width));
    }
    lines.push("");
  }

  // Roulette board
  const boardLines = renderBoard(state, width);
  lines.push(...boardLines);

  // Separator
  lines.push(`  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`);

  // Result message or betting info
  if (rs.phase === "result") {
    const num = rs.result!;
    const color = numberColor(num);
    const colorCode = color === "red" ? t.red : color === "green" ? t.green : t.white;
    const resultText = `Ball landed on ${colorCode}${t.bold}${num}${t.reset} (${color})`;

    if (rs.winAmount > 0) {
      const netWin = rs.winAmount - totalBets(state);
      lines.push(`  ${resultText}  ${t.green}${t.bold}WIN $${rs.winAmount.toLocaleString()}!${t.reset}`);
    } else {
      lines.push(`  ${resultText}  ${t.red}No win${t.reset}`);
    }
    lines.push(`  ${t.gray}Enter:new round  Esc:back to menu${t.reset}`);
  } else if (rs.phase === "spinning") {
    lines.push(`  ${t.yellow}Spinning...${t.reset}`);
    lines.push("");
  } else {
    if (state.message) {
      lines.push(`  ${t.yellow}${state.message}${t.reset}`);
    } else {
      lines.push("");
    }
    const hints = [
      `${t.white}Arrows${t.reset}${t.gray}:move${t.reset}`,
      `${t.white}Space${t.reset}${t.gray}:bet${t.reset}`,
      `${t.white}+/-${t.reset}${t.gray}:chip${t.reset}`,
      `${t.white}Enter${t.reset}${t.gray}:spin${t.reset}`,
      `${t.white}c${t.reset}${t.gray}:clear${t.reset}`,
      `${t.white}Esc${t.reset}${t.gray}:menu${t.reset}`,
    ];
    lines.push(`  ${hints.join("  ")}`);
  }

  return lines;
}

function renderWheel(highlight: number, width: number): string {
  // Show a segment of the wheel centered on the highlighted number
  const idx = WHEEL_ORDER.indexOf(highlight);
  const windowSize = 9; // show 9 numbers
  const half = Math.floor(windowSize / 2);

  let parts: string[] = [];
  for (let i = -half; i <= half; i++) {
    const wheelIdx = (idx + i + WHEEL_ORDER.length) % WHEEL_ORDER.length;
    const num = WHEEL_ORDER[wheelIdx] ?? 0;
    const color = numberColor(num);
    const isCenter = i === 0;

    let numStr = String(num).padStart(2, " ");

    if (isCenter) {
      // Highlighted center number with background
      const bgColor = color === "red" ? t.bgRed : color === "green" ? t.bgGreen : t.bgBlack;
      parts.push(`${bgColor}${t.white}${t.bold}[${numStr}]${t.reset}`);
    } else {
      const fgColor = color === "red" ? t.red : color === "green" ? t.green : t.gray;
      const dimness = Math.abs(i) > 2 ? t.dim : "";
      parts.push(`${dimness}${fgColor} ${numStr} ${t.reset}`);
    }
  }

  const wheelStr = parts.join("");
  // Center pointer
  const pointer = `${t.yellow}${t.bold}  ${"  ".repeat(half)}  v${t.reset}`;
  const wheelLine = centerAnsiText(wheelStr, width);
  return wheelLine;
}

function centerText(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function centerAnsiText(text: string, width: number): string {
  const visLen = t.stripAnsi(text).length;
  const pad = Math.max(0, Math.floor((width - visLen) / 2));
  return " ".repeat(pad) + text;
}

function renderBoard(state: AppState, width: number): string[] {
  const rs = state.roulette;
  const lines: string[] = [];

  // Calculate left padding to center the board
  const boardWidth = 1 + CELL_W * 12 + 1; // border + 12 cells + border
  // Add extra for the 0 cell on the left
  const totalBoardWidth = CELL_W + 1 + CELL_W * 12 + 1;
  const leftPad = Math.max(2, Math.floor((width - totalBoardWidth) / 2));
  const pad = " ".repeat(leftPad);

  // Zero cell + number grid (rows 1-3)
  const zeroH = CELL_H * 3 + 2; // spans all 3 number rows

  // Build the board line by line
  // Top border
  const zeroCursor = rs.cursorRow === 0;
  const zeroBorder = zeroCursor && rs.phase === "betting" ? t.yellow : t.gray;

  // Row by row rendering of the number grid with zero on the left
  for (let row = 1; row <= 3; row++) {
    // Top border of this row
    let topLine = pad;
    if (row === 1) {
      topLine += `${zeroBorder}┌${"─".repeat(CELL_W - 1)}┐${t.reset}`;
    } else {
      topLine += `${zeroBorder}│${" ".repeat(CELL_W - 1)}│${t.reset}`;
    }
    for (let col = 0; col < 12; col++) {
      const isCursor = rs.cursorRow === row && rs.cursorCol === col && rs.phase === "betting";
      const border = isCursor ? t.yellow : t.gray;
      if (row === 1) {
        topLine += col === 0 ? `${border}┌${"─".repeat(CELL_W - 1)}${t.reset}` : `${border}┬${"─".repeat(CELL_W - 1)}${t.reset}`;
      } else {
        topLine += col === 0 ? `${border}├${"─".repeat(CELL_W - 1)}${t.reset}` : `${border}┼${"─".repeat(CELL_W - 1)}${t.reset}`;
      }
    }
    topLine += row === 1 ? `${t.gray}┐${t.reset}` : `${t.gray}┤${t.reset}`;
    lines.push(topLine);

    // Content line
    let contentLine = pad;
    // Zero cell content (only in middle row)
    if (row === 2) {
      const zeroCell = cellAt(0, 0)!;
      const betOnZero = rs.bets.find(b => sameBet(zeroCell, b.type));
      const zeroContent = betOnZero ? `${t.bgGreen}${t.white}${t.bold} 0 ${t.reset}` : `${t.green}${t.bold} 0 ${t.reset}`;
      contentLine += `${zeroBorder}│${t.reset}${zeroContent}${zeroBorder}│${t.reset}`;
    } else {
      contentLine += `${zeroBorder}│${" ".repeat(CELL_W - 1)}│${t.reset}`;
    }

    for (let col = 0; col < 12; col++) {
      const cell = cellAt(row, col)!;
      const num = numberAt(row, col);
      const color = numberColor(num);
      const isCursor = rs.cursorRow === row && rs.cursorCol === col && rs.phase === "betting";
      const isSpinHighlight = (rs.phase === "spinning" || rs.phase === "result") && num === rs.spinHighlight;
      const betOnThis = rs.bets.find(b => sameBet(cell, b.type));
      const border = isCursor ? t.yellow : t.gray;

      let numStr = String(num).padStart(2, " ");
      let cellContent: string;

      if (isSpinHighlight) {
        cellContent = `${t.bold}${t.inverse} ${numStr} ${t.reset}`;
      } else if (betOnThis) {
        const bgColor = color === "red" ? t.bgRed : t.bgWhite;
        const fgColor = color === "red" ? t.white : t.bgBlack;
        cellContent = `${bgColor}${t.bold} ${numStr} ${t.reset}`;
      } else {
        const fgColor = color === "red" ? t.red : t.white;
        cellContent = `${fgColor} ${numStr} ${t.reset}`;
      }

      if (isCursor) {
        cellContent = `${t.bold}${t.yellow}[${numStr}]${t.reset}`;
      }

      contentLine += `${border}│${t.reset}${cellContent}`;
    }
    contentLine += `${t.gray}│${t.reset}`;
    lines.push(contentLine);
  }

  // Bottom border of number grid
  let botBorder = pad;
  botBorder += `${zeroBorder}└${"─".repeat(CELL_W - 1)}┘${t.reset}`;
  for (let col = 0; col < 12; col++) {
    botBorder += col === 0 ? `${t.gray}├${"─".repeat(CELL_W - 1)}${t.reset}` : `${t.gray}┼${"─".repeat(CELL_W - 1)}${t.reset}`;
  }
  botBorder += `${t.gray}┤${t.reset}`;
  lines.push(botBorder);

  // Row 4: Dozens
  let dozenLine = pad + " ".repeat(CELL_W);
  const dozenLabels = ["1st 12", "2nd 12", "3rd 12"];
  for (let d = 0; d < 3; d++) {
    const dozenWidth = CELL_W * 4;
    const isCursor = rs.cursorRow === 4 && Math.floor(rs.cursorCol / 4) === d && rs.phase === "betting";
    const cell = cellAt(4, d * 4)!;
    const betOnThis = rs.bets.find(b => sameBet(cell, b.type));
    const border = isCursor ? t.yellow : t.gray;
    const dlabel = dozenLabels[d] ?? "";
    const label = dlabel.padStart(Math.floor((dozenWidth - 1 + dlabel.length) / 2)).padEnd(dozenWidth - 1);

    if (isCursor) {
      dozenLine += `${border}│${t.yellow}${t.bold}${label}${t.reset}`;
    } else if (betOnThis) {
      dozenLine += `${border}│${t.cyan}${t.bold}${label}${t.reset}`;
    } else {
      dozenLine += `${border}│${t.gray}${label}${t.reset}`;
    }
  }
  dozenLine += `${t.gray}│${t.reset}`;
  lines.push(dozenLine);

  // Row 4 bottom border
  let dozenBot = pad + " ".repeat(CELL_W);
  for (let col = 0; col < 12; col++) {
    dozenBot += col === 0 ? `${t.gray}├${"─".repeat(CELL_W - 1)}${t.reset}` : `${t.gray}┼${"─".repeat(CELL_W - 1)}${t.reset}`;
  }
  dozenBot += `${t.gray}┤${t.reset}`;
  lines.push(dozenBot);

  // Row 5: Outside bets (1-18, Even, Red, Black, Odd, 19-36)
  const outsideLabels = ["1-18", "EVEN", " RED", " BLK", " ODD", "19-36"];
  const outsideColors = [t.white, t.white, t.red, t.white, t.white, t.white];
  let outsideLine = pad + " ".repeat(CELL_W);
  for (let o = 0; o < 6; o++) {
    const cellWidth = CELL_W * 2;
    const colStart = o * 2;
    const isCursor = rs.cursorRow === 5 && Math.floor(rs.cursorCol / 2) === o && rs.phase === "betting";
    const cell = cellAt(5, colStart)!;
    const betOnThis = rs.bets.find(b => sameBet(cell, b.type));
    const border = isCursor ? t.yellow : t.gray;
    const olabel = outsideLabels[o] ?? "";
    const label = olabel.padStart(Math.floor((cellWidth - 1 + olabel.length) / 2)).padEnd(cellWidth - 1);
    const ocolor = outsideColors[o] ?? t.white;

    if (isCursor) {
      outsideLine += `${border}│${t.yellow}${t.bold}${label}${t.reset}`;
    } else if (betOnThis) {
      outsideLine += `${border}│${ocolor}${t.bold}${label}${t.reset}`;
    } else {
      outsideLine += `${border}│${t.gray}${label}${t.reset}`;
    }
  }
  outsideLine += `${t.gray}│${t.reset}`;
  lines.push(outsideLine);

  // Row 5 bottom border
  let outsideBot = pad + " ".repeat(CELL_W);
  for (let col = 0; col < 12; col++) {
    outsideBot += col === 0 ? `${t.gray}└${"─".repeat(CELL_W - 1)}${t.reset}` : `${t.gray}┴${"─".repeat(CELL_W - 1)}${t.reset}`;
  }
  outsideBot += `${t.gray}┘${t.reset}`;
  lines.push(outsideBot);

  // Row 6: Column bets (below the grid)
  const colLabels = ["Col 1", "Col 2", "Col 3"];
  let colLine = pad + " ".repeat(CELL_W);
  for (let c = 0; c < 3; c++) {
    const colWidth = CELL_W * 4;
    const isCursor = rs.cursorRow === 6 && Math.floor(rs.cursorCol / 4) === c && rs.phase === "betting";
    const cell = cellAt(6, c * 4)!;
    const betOnThis = rs.bets.find(b => sameBet(cell, b.type));
    const clabel = colLabels[c] ?? "";
    const label = clabel.padStart(Math.floor((colWidth + clabel.length) / 2)).padEnd(colWidth);

    if (isCursor) {
      colLine += `${t.yellow}${t.bold}${label}${t.reset}`;
    } else if (betOnThis) {
      colLine += `${t.cyan}${t.bold}${label}${t.reset}`;
    } else {
      colLine += `${t.gray}${label}${t.reset}`;
    }
  }
  lines.push(colLine);

  return lines;
}
