import type { AppState } from "../types";
import type { KeyEvent } from "../keybindings";
import { sendCode, verifyCode, getMe, resetBalance as apiResetBalance } from "./client";
import { saveAuth, clearAuth } from "./store";

export function handleLoginKey(state: AppState, key: KeyEvent, render: () => void): void {
  const auth = state.auth;

  if (auth.phase === "sending" || auth.phase === "verifying") return; // ignore input during async ops

  if (key.name === "escape" || (key.name === "q" && auth.phase === "email-input" && auth.emailInput === "")) {
    state.screen = "menu";
    state.auth.phase = "email-input";
    state.auth.emailInput = "";
    state.auth.codeInput = "";
    state.auth.error = "";
    return;
  }

  if (auth.phase === "email-input") {
    handleEmailInput(state, key, render);
  } else if (auth.phase === "code-input") {
    handleCodeInput(state, key, render);
  } else if (auth.phase === "error") {
    // Any key goes back to email input
    auth.phase = "email-input";
    auth.error = "";
  }
}

function handleEmailInput(state: AppState, key: KeyEvent, render: () => void): void {
  const auth = state.auth;

  if (key.name === "return" && auth.emailInput.includes("@")) {
    auth.phase = "sending";
    auth.error = "";
    render();

    sendCode(auth.emailInput).then((res) => {
      if (res.error) {
        auth.phase = "error";
        auth.error = res.error;
      } else {
        auth.phase = "code-input";
        auth.codeInput = "";
      }
      render();
    }).catch(() => {
      auth.phase = "error";
      auth.error = "Could not reach server";
      render();
    });
    return;
  }

  if (key.name === "backspace") {
    auth.emailInput = auth.emailInput.slice(0, -1);
    return;
  }

  // Accept printable characters for email
  if (key.raw.length === 1 && !key.ctrl && key.raw.charCodeAt(0) >= 32) {
    auth.emailInput += key.raw;
  }
}

function handleCodeInput(state: AppState, key: KeyEvent, render: () => void): void {
  const auth = state.auth;

  if (key.name === "escape") {
    auth.phase = "email-input";
    auth.codeInput = "";
    auth.error = "";
    return;
  }

  if (key.name === "backspace") {
    auth.codeInput = auth.codeInput.slice(0, -1);
    return;
  }

  // Accept digits only
  if (key.raw >= "0" && key.raw <= "9" && auth.codeInput.length < 6) {
    auth.codeInput += key.raw;
  }

  // Auto-submit or Enter
  if (auth.codeInput.length === 6 || (key.name === "return" && auth.codeInput.length === 6)) {
    if (auth.codeInput.length === 6) {
      submitCode(state, render);
    }
  }
}

function submitCode(state: AppState, render: () => void): void {
  const auth = state.auth;
  auth.phase = "verifying";
  auth.error = "";
  render();

  verifyCode(auth.emailInput, auth.codeInput).then((res) => {
    if (res.error) {
      auth.phase = "code-input";
      auth.codeInput = "";
      auth.error = res.error;
      render();
      return;
    }

    // Save auth and update state
    saveAuth({ token: res.token, email: res.user.email, userId: res.user.id });
    state.auth.loggedIn = true;
    state.auth.email = res.user.email;
    state.auth.token = res.token;
    state.auth.userId = res.user.id;

    // Sync balance from server
    state.balance = res.user.balance / 100; // server stores cents

    // Return to menu
    state.screen = "menu";
    state.message = `Logged in as ${res.user.email}`;
    state.auth.phase = "email-input";
    state.auth.emailInput = "";
    state.auth.codeInput = "";
    state.auth.error = "";
    render();
  }).catch(() => {
    auth.phase = "error";
    auth.error = "Could not reach server";
    render();
  });
}

/** Verify existing token on startup. Returns true if valid. */
export async function verifySession(state: AppState): Promise<boolean> {
  if (!state.auth.token) return false;

  try {
    const res = await getMe(state.auth.token);
    if (res.error) {
      clearAuth();
      state.auth.loggedIn = false;
      state.auth.token = "";
      state.auth.email = "";
      state.auth.userId = 0;
      return false;
    }

    state.auth.email = res.email;
    state.auth.userId = res.id;
    state.auth.loggedIn = true;
    state.balance = res.balance / 100; // server stores cents
    return true;
  } catch {
    return false; // offline, keep local state
  }
}

/** Sync balance to server (fire-and-forget). */
export function syncBalanceToServer(state: AppState): void {
  if (!state.auth.loggedIn || !state.auth.token) return;

  const { syncBalance } = require("./client");
  syncBalance(state.auth.token, Math.round(state.balance * 100)).catch(() => {});
}

/** Server-side balance reset with throttle. */
export async function serverResetBalance(state: AppState, render: () => void): Promise<void> {
  if (!state.auth.loggedIn || !state.auth.token) {
    state.balance = 1000;
    state.message = "Balance reset to $1,000";
    return;
  }

  try {
    const res = await apiResetBalance(state.auth.token);
    if (res.error) {
      state.message = res.error;
    } else {
      state.balance = (res.balance ?? 100000) / 100;
      state.message = "Balance reset to $1,000";
    }
  } catch {
    state.message = "Could not reach server";
  }
  render();
}
