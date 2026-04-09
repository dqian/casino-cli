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

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function shortTx(hash: string): string {
  if (hash.length <= 16) return hash;
  return hash.slice(0, 10) + "..." + hash.slice(-4);
}

export function renderDepositScreen(state: AppState): string[] {
  const { columns: width, rows: height } = process.stdout;
  const lines: string[] = [];
  const w = state.wallet;

  const topPad = Math.max(1, Math.floor((height - 22) / 2));
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
    const copyLabel = w.copied
      ? `${t.green}${t.bold}Copied!${t.reset}`
      : `${t.cyan}${t.underline}[c] Copy address${t.reset}`;
    lines.push(center(copyLabel, width));
    lines.push("");

    // Balance
    const displayBalance = formatUsdc(w.usdcBalance);
    lines.push(center(`${t.white}USDC Balance: ${t.green}${t.bold}$${displayBalance}${t.reset}`, width));
    lines.push("");

    // Recent deposits
    if (w.deposits.length > 0) {
      lines.push(center(`${t.gray}${"─".repeat(44)}${t.reset}`, width));
      lines.push(center(`${t.white}${t.bold}Recent deposits (24h)${t.reset}`, width));
      lines.push("");

      const shown = w.deposits.slice(-5).reverse(); // last 5, newest first
      for (const dep of shown) {
        const amt = formatUsdc(dep.amount);
        const from = shortAddr(dep.from);
        const tx = shortTx(dep.tx_hash);
        lines.push(center(`${t.green}+$${amt}${t.reset}  ${t.gray}from ${t.white}${from}${t.reset}  ${t.gray}tx ${t.dim}${tx}${t.reset}`, width));
      }
    } else {
      lines.push(center(`${t.gray}${t.dim}No recent deposits${t.reset}`, width));
    }

    lines.push("");
    lines.push(center(`${t.gray}${t.dim}Only send USDC on Base chain. Other tokens or chains will be lost.${t.reset}`, width));
  }

  // Fill
  while (lines.length < height - 3) lines.push("");

  // Hotkeys
  lines.push(`  ${t.gray}${"─".repeat(Math.max(0, width - 4))}${t.reset}`);
  lines.push(`  ${t.white}${t.bold}c${t.reset}  ${t.gray}Copy address${t.reset}  ${t.white}${t.bold}r${t.reset}  ${t.gray}Refresh balance${t.reset}  ${t.white}${t.bold}Esc${t.reset}  ${t.gray}Back to menu${t.reset}`);

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

    if (w.error) {
      lines.push(center(`${t.red}${w.error}${t.reset}`, width));
    } else if (w.withdrawAddress.length === 0) {
      lines.push(center(`${t.gray}Paste or type a 0x address${t.reset}`, width));
    } else if (w.withdrawAddress.length < 42) {
      lines.push(center(`${t.gray}${t.dim}Keep typing... (${w.withdrawAddress.length}/42)${t.reset}`, width));
    } else {
      lines.push(center(`${t.green}Press Enter to continue${t.reset}`, width));
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
    lines.push("");

    // Show USDC balance + MAX link
    const displayBalance = formatUsdc(w.usdcBalance);
    lines.push(center(`${t.gray}Available: ${t.green}$${displayBalance}${t.reset}   ${t.cyan}${t.underline}[m] MAX${t.reset}`, width));

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
  } else if (w.withdrawPhase === "code-sending") {
    lines.push(center(`${t.cyan}Sending confirmation code to your email...${t.reset}`, width));
  } else if (w.withdrawPhase === "code-input") {
    const parsed = parseFloat(w.withdrawAmount);
    lines.push(center(`${t.white}Withdrawing ${t.green}${t.bold}$${parsed.toFixed(2)} USDC${t.reset}${t.white} to ${t.cyan}${w.withdrawAddress}${t.reset}`, width));
    lines.push("");
    lines.push(center(`${t.white}Enter the 6-digit code sent to your email:${t.reset}`, width));
    lines.push("");

    // 6-digit code display
    const digits = w.withdrawCode.padEnd(6, " ");
    let codeDisplay = "";
    for (let i = 0; i < 6; i++) {
      const ch = digits[i]!;
      if (ch !== " ") {
        codeDisplay += ` ${t.brightWhite}${t.bold}${ch}${t.reset} `;
      } else if (i === w.withdrawCode.length) {
        codeDisplay += ` ${t.brightWhite}${t.bold}_${t.reset} `;
      } else {
        codeDisplay += ` ${t.gray}·${t.reset} `;
      }
      if (i < 5) codeDisplay += " ";
    }
    lines.push(center(codeDisplay, width));

    if (w.error) {
      lines.push("");
      lines.push(center(`${t.red}${w.error}${t.reset}`, width));
    }
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
  if (w.withdrawPhase === "address-input" || w.withdrawPhase === "amount-input" || w.withdrawPhase === "code-input") {
    lines.push(`  ${t.white}${t.bold}Esc${t.reset}  ${t.gray}Back${t.reset}`);
  } else {
    lines.push("");
  }

  while (lines.length < height) lines.push("");
  return lines;
}
