// ANSI escape helpers — zero dependencies

const ESC = "\x1b[";

export const reset = `${ESC}0m`;
export const bold = `${ESC}1m`;
export const dim = `${ESC}2m`;
export const italic = `${ESC}3m`;
export const underline = `${ESC}4m`;
export const inverse = `${ESC}7m`;
export const strikethrough = `${ESC}9m`;

export const red = `${ESC}31m`;
export const green = `${ESC}32m`;
export const yellow = `${ESC}33m`;
export const blue = `${ESC}34m`;
export const magenta = `${ESC}35m`;
export const cyan = `${ESC}36m`;
export const white = `${ESC}37m`;
export const gray = `${ESC}90m`;

export const bgRed = `${ESC}41m`;
export const bgGreen = `${ESC}42m`;
export const bgYellow = `${ESC}43m`;
export const bgBlue = `${ESC}44m`;
export const bgMagenta = `${ESC}45m`;
export const bgCyan = `${ESC}46m`;
export const bgWhite = `${ESC}47m`;
export const bgBlack = `${ESC}40m`;
export const bgBrightRed = `${ESC}101m`;
export const bgBrightGreen = `${ESC}102m`;

// 256-color support
export const fg256 = (n: number) => `${ESC}38;5;${n}m`;
export const bg256 = (n: number) => `${ESC}48;5;${n}m`;

// Screen control
export const clearScreen = `${ESC}2J${ESC}H`;
export const cursorHome = `${ESC}H`;
export const eraseLine = `${ESC}2K`;
export const hideCursor = `${ESC}?25l`;
export const showCursor = `${ESC}?25h`;
export const altScreenOn = `${ESC}?1049h`;
export const altScreenOff = `${ESC}?1049l`;
export const mouseOn = `${ESC}?1000h${ESC}?1006h`;
export const mouseOff = `${ESC}?1000l${ESC}?1006l`;
export const cursorTo = (row: number, col: number) => `${ESC}${row + 1};${col + 1}H`;

// Disable scroll region (full screen)
export const scrollRegionFull = (rows: number) => `${ESC}1;${rows}r`;

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m|\x1b\]8;;[^\x07]*\x07/g, "");
}
