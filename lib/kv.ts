// Vercel KV (Upstash Redis) REST client — zero dependencies
// Requires: KV_REST_API_URL + KV_REST_API_TOKEN env vars
// Add KV to your Vercel project: vercel.com → Storage → KV → Create

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function assertKv() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error("KV not configured. Add KV_REST_API_URL + KV_REST_API_TOKEN env vars.");
  }
}

async function kvFetch(path: string, init?: RequestInit) {
  assertKv();
  const res = await fetch(`${KV_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`KV ${path} failed: ${res.status}`);
  return res.json();
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const data = await kvFetch(`/get/${encodeURIComponent(key)}`);
  if (data.result === null || data.result === undefined) return null;
  try { return JSON.parse(data.result) as T; } catch { return data.result as T; }
}

export async function kvSet(key: string, value: unknown, exSeconds?: number): Promise<void> {
  const payload = JSON.stringify(value);
  // Vercel KV REST: POST /set/key ["value"] or ["value", "EX", 3600]
  const args: unknown[] = [payload];
  if (exSeconds) { args.push("EX"); args.push(exSeconds); }
  await kvFetch(`/set/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function kvDel(key: string): Promise<void> {
  await kvFetch(`/del/${encodeURIComponent(key)}`, { method: "POST" });
}

export async function kvLpush(key: string, value: unknown): Promise<void> {
  await kvFetch(`/lpush/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify([JSON.stringify(value)]),
  });
}

export async function kvLrange<T>(key: string, start = 0, stop = -1): Promise<T[]> {
  const data = await kvFetch(`/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
  return (data.result ?? []).map((item: string) => {
    try { return JSON.parse(item) as T; } catch { return item as T; }
  });
}

export async function kvLpop<T>(key: string): Promise<T | null> {
  const data = await kvFetch(`/lpop/${encodeURIComponent(key)}`, { method: "POST", body: JSON.stringify([]) });
  if (!data.result) return null;
  try { return JSON.parse(data.result) as T; } catch { return data.result as T; }
}

export function kvAvailable(): boolean {
  return !!(KV_URL && KV_TOKEN);
}
