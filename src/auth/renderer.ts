import type { AppState } from "../types";
import * as t from "../theme";

export function renderLoginScreen(state: AppState): string[] {
  const { columns: width, rows: height } = process.stdout;
  const lines: string[] = [];
  const auth = state.auth;

  const center = (text: string) => {
    const visLen = t.stripAnsi(text).length;
    const pad = Math.max(0, Math.floor((width - visLen) / 2));
    return " ".repeat(pad) + text;
  };

  // Vertical centering
  const contentHeight = 16;
  const topPad = Math.max(1, Math.floor((height - contentHeight) / 2));
  for (let i = 0; i < topPad; i++) lines.push("");

  // Header
  lines.push(center(`${t.bold}${t.yellow}SIGN IN${t.reset}`));
  lines.push(center(`${t.gray}${"─".repeat(40)}${t.reset}`));
  lines.push("");
  lines.push(center(`${t.gray}Sign in to save your play money progress${t.reset}`));
  lines.push(center(`${t.gray}across sessions and devices.${t.reset}`));
  lines.push("");

  if (auth.phase === "email-input" || auth.phase === "sending") {
    lines.push(center(`${t.white}Email address:${t.reset}`));
    lines.push("");

    // Email input field
    const inputWidth = 36;
    const emailDisplay = auth.emailInput || "";
    const cursor = auth.phase === "sending" ? " " : `${t.brightWhite}${t.bold}_${t.reset}`;
    const inputContent = emailDisplay + cursor;
    const padding = Math.max(0, inputWidth - t.stripAnsi(inputContent).length);
    const field = `${t.dim}[${t.reset} ${t.brightWhite}${inputContent}${" ".repeat(padding)}${t.reset}${t.dim}]${t.reset}`;
    lines.push(center(field));
    lines.push("");

    if (auth.phase === "sending") {
      lines.push(center(`${t.cyan}Sending code...${t.reset}`));
    } else {
      lines.push(center(`${t.gray}Press Enter to receive a login code${t.reset}`));
    }
  } else if (auth.phase === "code-input" || auth.phase === "verifying") {
    lines.push(center(`${t.white}Code sent to ${t.cyan}${auth.emailInput}${t.reset}`));
    lines.push("");

    // 6-digit code display with boxes
    const digits = auth.codeInput.padEnd(6, " ");
    let codeDisplay = "";
    for (let i = 0; i < 6; i++) {
      const ch = digits[i]!;
      if (ch !== " ") {
        codeDisplay += ` ${t.brightWhite}${t.bold}${ch}${t.reset} `;
      } else if (i === auth.codeInput.length && auth.phase !== "verifying") {
        codeDisplay += ` ${t.brightWhite}${t.bold}_${t.reset} `;
      } else {
        codeDisplay += ` ${t.gray}·${t.reset} `;
      }
      if (i < 5) codeDisplay += " ";
    }
    lines.push(center(codeDisplay));
    lines.push("");

    if (auth.phase === "verifying") {
      lines.push(center(`${t.cyan}Verifying...${t.reset}`));
    } else {
      lines.push(center(`${t.gray}Enter the 6-digit code from your email${t.reset}`));
    }

    if (auth.error) {
      lines.push("");
      lines.push(center(`${t.red}${auth.error}${t.reset}`));
    }
  } else if (auth.phase === "error") {
    lines.push(center(`${t.red}${auth.error}${t.reset}`));
    lines.push("");
    lines.push(center(`${t.gray}Press any key to try again${t.reset}`));
  }

  // Fill
  while (lines.length < height - 3) lines.push("");

  // Hotkeys
  lines.push(`  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`);
  const hotkeys = auth.phase === "code-input"
    ? `  ${t.white}${t.bold}0-9${t.reset}  ${t.gray}Enter code${t.reset}  ${t.white}${t.bold}Esc${t.reset}  ${t.gray}Back to email${t.reset}`
    : `  ${t.white}${t.bold}Esc${t.reset}  ${t.gray}Back to menu${t.reset}`;
  lines.push(hotkeys);

  while (lines.length < height) lines.push("");
  return lines;
}
