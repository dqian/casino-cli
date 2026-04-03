export interface KeyEvent {
  name: string;
  ctrl: boolean;
  shift: boolean;
  raw: string;
}

export function parseKey(data: Buffer): KeyEvent {
  const raw = data.toString("utf-8");
  const bytes = [...data];

  // Ctrl+C
  if (bytes.length === 1 && bytes[0] === 3) {
    return { name: "c", ctrl: true, shift: false, raw };
  }

  // Enter
  if (bytes.length === 1 && (bytes[0] === 13 || bytes[0] === 10)) {
    return { name: "return", ctrl: false, shift: false, raw };
  }

  // Backspace
  if (bytes.length === 1 && (bytes[0] === 127 || bytes[0] === 8)) {
    return { name: "backspace", ctrl: false, shift: false, raw };
  }

  // Tab
  if (bytes.length === 1 && bytes[0] === 9) {
    return { name: "tab", ctrl: false, shift: false, raw };
  }

  // Escape sequences
  if (bytes[0] === 0x1b) {
    if (bytes.length === 1) {
      return { name: "escape", ctrl: false, shift: false, raw };
    }
    if (bytes[1] === 0x5b) {
      const rawStr = raw;
      switch (rawStr) {
        case "\x1b[A": return { name: "up", ctrl: false, shift: false, raw };
        case "\x1b[B": return { name: "down", ctrl: false, shift: false, raw };
        case "\x1b[C": return { name: "right", ctrl: false, shift: false, raw };
        case "\x1b[D": return { name: "left", ctrl: false, shift: false, raw };
        case "\x1b[H": return { name: "home", ctrl: false, shift: false, raw };
        case "\x1b[F": return { name: "end", ctrl: false, shift: false, raw };
        case "\x1b[3~": return { name: "delete", ctrl: false, shift: false, raw };
      }
    }
    return { name: "escape", ctrl: false, shift: false, raw };
  }

  // Printable character
  if (raw.length === 1 && (bytes[0] ?? 0) >= 32) {
    const isUpper = raw >= "A" && raw <= "Z";
    return { name: raw, ctrl: false, shift: isUpper, raw };
  }

  return { name: raw, ctrl: false, shift: false, raw };
}
