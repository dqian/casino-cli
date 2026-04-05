import * as t from "../theme";

export function centerAnsi(text: string, width: number): string {
  const visLen = t.stripAnsi(text).length;
  const pad = Math.max(0, Math.floor((width - visLen) / 2));
  return " ".repeat(pad) + text;
}

export function widthWarning(width: number, minWidth: number): string | null {
  if (width >= minWidth) return null;
  return `  ${t.yellow}${t.bold}\u26A0 Terminal too narrow (need ${minWidth} cols)${t.reset}`;
}

export function formatBalance(balance: number): string {
  return `$${balance.toLocaleString()}`;
}

export function renderHeader(
  title: string, balance: number, width: number, rightContent?: string,
): string[] {
  const balStr = formatBalance(balance);
  let line = `  ${t.bold}${t.yellow}${title}${t.reset}  ${t.green}${balStr}${t.reset}`;
  if (rightContent) {
    const leftVis = t.stripAnsi(line).length;
    const rightVis = t.stripAnsi(rightContent).length;
    const pad = Math.max(1, width - leftVis - rightVis);
    line += " ".repeat(pad) + rightContent;
  }
  const sep = `  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`;
  return [line, sep];
}

export type HotkeyItem = { key: string; label: string };

export function renderHotkeySplit(
  left: HotkeyItem[], right: HotkeyItem[], width: number,
): string[] {
  const all = [...left, ...right];
  if (all.length === 0) return [""];

  function renderCell(h: HotkeyItem, maxK: number, maxL: number): string {
    return `${t.white}${t.bold}${h.key.padStart(maxK)}${t.reset}  ${t.gray}${h.label.padEnd(maxL)}${t.reset}`;
  }

  const maxRows = Math.max(left.length, right.length);
  const lMaxK = left.length > 0 ? Math.max(...left.map(h => h.key.length)) : 0;
  const lMaxL = left.length > 0 ? Math.max(...left.map(h => h.label.length)) : 0;
  const rMaxK = right.length > 0 ? Math.max(...right.map(h => h.key.length)) : 0;
  const rMaxL = right.length > 0 ? Math.max(...right.map(h => h.label.length)) : 0;
  const margin = 2;

  const gridLines: string[] = [];
  for (let r = 0; r < maxRows; r++) {
    let leftPart = "";
    if (r < left.length) leftPart = renderCell(left[r]!, lMaxK, lMaxL);
    const leftVisLen = t.stripAnsi(leftPart).length;

    let rightPart = "";
    if (r < right.length) rightPart = renderCell(right[r]!, rMaxK, rMaxL);
    const rightVisLen = t.stripAnsi(rightPart).length;

    const gap = Math.max(2, width - margin * 2 - leftVisLen - rightVisLen);
    gridLines.push(" ".repeat(margin) + leftPart + " ".repeat(gap) + rightPart);
  }
  return gridLines;
}

// Slice an ANSI-colored string by visual character positions [start, end)
export function sliceAnsi(str: string, start: number, end: number): string {
  let result = "";
  let visPos = 0;
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\x1b' && str[i + 1] === '[') {
      const escStart = i;
      i += 2;
      while (i < str.length && str[i] !== 'm') i++;
      i++;
      if (visPos >= start && visPos < end) result += str.slice(escStart, i);
      continue;
    }
    if (visPos >= end) break;
    if (visPos >= start) result += str[i];
    visPos++;
    i++;
  }
  if (result.length > 0) result += t.reset;
  return result;
}
