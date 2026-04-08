const API_BASE = process.env.CASINO_API_URL || "http://localhost:3000";

export interface ApiUser {
  id: number;
  email: string;
  balance: number;
  is_new?: boolean;
}

interface SendCodeResponse {
  ok: boolean;
  error?: string;
}

interface VerifyCodeResponse {
  token: string;
  user: ApiUser;
  error?: string;
}

interface MeResponse extends ApiUser {
  privy_user_id: string | null;
  created_at: string;
  error?: string;
}

interface BalanceResponse {
  ok?: boolean;
  balance?: number;
  error?: string;
}

async function post(path: string, body: object, token?: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
    return res.json();
  }
  if (!res.ok) {
    return { error: `Server error (${res.status})` };
  }

  return res.json();
}

async function get(path: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
    return res.json();
  }
  if (!res.ok) {
    return { error: `Server error (${res.status})` };
  }

  return res.json();
}

export async function sendCode(email: string): Promise<SendCodeResponse> {
  return post("/auth/send-code", { email });
}

export async function verifyCode(email: string, code: string): Promise<VerifyCodeResponse> {
  return post("/auth/verify-code", { email, code });
}

export async function getMe(token: string): Promise<MeResponse> {
  return get("/me", token);
}

export async function syncBalance(token: string, balance: number): Promise<BalanceResponse> {
  return post("/balance/sync", { balance }, token);
}

export async function resetBalance(token: string): Promise<BalanceResponse> {
  return post("/balance/reset", {}, token);
}
