import crypto from "crypto";

export interface HelmSession {
  email: string;
  artistId: string;
  customerId: string;
  plan: "heatseeker";
  exp: number;
}

export const COOKIE_NAME = "helm_session";
export const TTL = 30 * 24 * 60 * 60; // 30 days in seconds

function getSecret() {
  return process.env.HELM_SESSION_SECRET || "helm-dev-secret-change-me-in-prod";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function encodeSession(data: Omit<HelmSession, "exp">): string {
  const payload = JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + TTL });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export function decodeSession(token: string): HelmSession | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return null;
    const encoded = token.substring(0, dotIdx);
    const sig = token.substring(dotIdx + 1);
    if (sign(encoded) !== sig) return null;
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data as HelmSession;
  } catch {
    return null;
  }
}
