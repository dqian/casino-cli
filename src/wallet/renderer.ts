import type { AppState } from "../types";
import * as t from "../theme";

function center(text: string, width: number): string {
  const visLen = t.stripAnsi(text).length;
  const pad = Math.max(0, Math.floor((width - visLen) / 2));
  return " ".repeat(pad) + text;
}

function formatUsdc(baseUnits: string): string {
  const raw = BigInt(baseUnits);
  const whole = raw / 1_000_000n;
  const frac = raw % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "") || "0";
  return `${whole.toLocaleString()}.${fracStr.slice(0, 2).padEnd(2, "0")}`;
}

export function renderDepositScreen(state: AppState): string[] {
  const { columns: width, rows: height } = process.stdout;
  const lines: string[] = [];
  const w = state.wallet;

  const topPad = Math.max(1, Math.floor((height - 18) / 2));
  for (let i = 0; i < topPad; i++) lines.push("");

  lines.push(center(`${t.bold}${t.yellow}DEPOSIT${t.reset}`, width));
  lines.push(center(`${t.gray}${"─".repeat(44)}${t.reset}`, width));
  lines.push("");
  lines.push(center(`${t.gray}Send USDC on Base to your deposit address${t.reset}`, width));
  lines.push("");

  if (w.depositPhase === "loading") {
    lines.push(center(`${t.cyan}Loading wallet...${t.reset}`, width));
  } else if (w.depositPhase === "error") {
    lines.push(center(`${t.red}${w.error}${t.reset}`, width));
  } else {
    // Address
    lines.push(center(`${t.white}Your deposit address (Base):${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.green}${t.bold}${w.walletAddress}${t.reset}`, width));
    lines.push("");

    // Balance
    const displayBalance = formatUsdc(w.usdcBalance);
    lines.push(center(`${t.white}USDC Balance: ${t.green}${t.bold}$${displayBalance}${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.gray}${t.dim}Only send USDC on Base chain. Other tokens or chains will be lost.${t.reset}`, width));
  }

  // Fill
  while (lines.length < height - 3) lines.push("");

  // Hotkeys
  lines.push(`  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`);
  lines.push(`  ${t.white}${t.bold}r${t.reset}  ${t.gray}Refresh${t.reset}  ${t.white}${t.bold}Esc${t.reset}  ${t.gray}Back to menu${t.reset}`);

  while (lines.length < height) lines.push("");
  return lines;
}

export function renderWithdrawScreen(state: AppState): string[] {
  const { columns: width, rows: height } = process.stdout;
  const lines: string[] = [];
  const w = state.wallet;

  const topPad = Math.max(1, Math.floor((height - 18) / 2));
  for (let i = 0; i < topPad; i++) lines.push("");

  lines.push(center(`${t.bold}${t.yellow}WITHDRAW${t.reset}`, width));
  lines.push(center(`${t.gray}${"─".repeat(44)}${t.reset}`, width));
  lines.push("");
  lines.push(center(`${t.gray}Send USDC on Base to any address${t.reset}`, width));
  lines.push("");

  if (w.withdrawPhase === "address-input") {
    lines.push(center(`${t.white}Destination address:${t.reset}`, width));
    lines.push("");

    const cursor = `${t.brightWhite}${t.bold}_${t.reset}`;
    const display = w.withdrawAddress || "";
    const inputWidth = 44;
    const padding = Math.max(0, inputWidth - display.length - 1);
    const field = `${t.dim}[${t.reset} ${t.brightWhite}${display}${cursor}${" ".repeat(padding)}${t.reset}${t.dim}]${t.reset}`;
    lines.push(center(field, width));
    lines.push("");

    const valid = /^0x[0-9a-fA-F]{40}$/.test(w.withdrawAddress);
    if (w.withdrawAddress.length > 0 && !valid) {
      lines.push(center(`${t.gray}${t.dim}Enter a valid 0x address (42 chars)${t.reset}`, width));
    } else if (valid) {
      lines.push(center(`${t.green}Press Enter to continue${t.reset}`, width));
    } else {
      lines.push(center(`${t.gray}Paste or type a 0x address${t.reset}`, width));
    }
  } else if (w.withdrawPhase === "amount-input") {
    lines.push(center(`${t.white}To: ${t.cyan}${w.withdrawAddress}${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.white}Amount (USDC):${t.reset}`, width));
    lines.push("");

    const cursor = `${t.brightWhite}${t.bold}_${t.reset}`;
    const display = w.withdrawAmount || "";
    const inputWidth = 20;
    const padding = Math.max(0, inputWidth - display.length - 1);
    const field = `${t.dim}[${t.reset} ${t.brightWhite}$${display}${cursor}${" ".repeat(padding)}${t.reset}${t.dim}]${t.reset}`;
    lines.push(center(field, width));

    if (w.error) {
      lines.push("");
      lines.push(center(`${t.red}${w.error}${t.reset}`, width));
    }
  } else if (w.withdrawPhase === "confirm") {
    const parsed = parseFloat(w.withdrawAmount);
    lines.push(center(`${t.white}Confirm withdrawal:${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.white}To:     ${t.cyan}${w.withdrawAddress}${t.reset}`, width));
    lines.push(center(`${t.white}Amount: ${t.green}${t.bold}$${parsed.toFixed(2)} USDC${t.reset}`, width));
    lines.push(center(`${t.white}Chain:  ${t.blue}Base${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.yellow}${t.bold}Send? (y/n)${t.reset}`, width));
  } else if (w.withdrawPhase === "sending") {
    lines.push(center(`${t.cyan}Sending transaction...${t.reset}`, width));
  } else if (w.withdrawPhase === "success") {
    lines.push(center(`${t.green}${t.bold}Withdrawal sent!${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.white}Tx: ${t.cyan}${w.txHash}${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.gray}Press any key to continue${t.reset}`, width));
  } else if (w.withdrawPhase === "error") {
    lines.push(center(`${t.red}${w.error}${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.gray}Press any key to continue${t.reset}`, width));
  }

  // Fill
  while (lines.length < height - 3) lines.push("");

  // Hotkeys
  lines.push(`  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`);
  if (w.withdrawPhase === "address-input" || w.withdrawPhase === "amount-input") {
    lines.push(`  ${t.white}${t.bold}Esc${t.reset}  ${t.gray}Back${t.reset}`);
  } else {
    lines.push("");
  }

  while (lines.length < height) lines.push("");
  return lines;
}
