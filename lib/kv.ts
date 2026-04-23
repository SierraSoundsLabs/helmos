// Vercel KV (Upstash Redis) REST client — with in-memory fallback
// Requires: KV_REST_API_URL + KV_REST_API_TOKEN env vars for persistence
// Falls back to in-memory Map when env vars are not set (data lost on cold start)

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// In-memory fallback store
const memStore = new Map<string, { value: string; expiresAt?: number }>();

function isMemMode() {
  return !KV_URL || !KV_TOKEN;
}

function memGet(key: string): string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: string, exSeconds?: number) {
  memStore.set(key, {
    value,
    expiresAt: exSeconds ? Date.now() + exSeconds * 1000 : undefined,
  });
}

function memDel(key: string) {
  memStore.delete(key);
}

function memLpush(key: string, value: string) {
  const existing = memGet(key);
  const list: string[] = existing ? JSON.parse(existing) : [];
  list.unshift(value);
  memSet(key, JSON.stringify(list));
}

function memLrange(key: string, start: number, stop: number): string[] {
  const existing = memGet(key);
  if (!existing) return [];
  const list: string[] = JSON.parse(existing);
  return stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
}

function memLpop(key: string): string | null {
  const existing = memGet(key);
  if (!existing) return null;
  const list: string[] = JSON.parse(existing);
  if (list.length === 0) return null;
  const item = list.pop()!;
  memSet(key, JSON.stringify(list));
  return item;
}

async function kvFetch(path: string, init?: RequestInit) {
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
  if (isMemMode()) {
    const raw = memGet(key);
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as T; }
  }
  const data = await kvFetch(`/get/${encodeURIComponent(key)}`);
  if (data.result === null || data.result === undefined) return null;
  try { return JSON.parse(data.result) as T; } catch { return data.result as T; }
}

export async function kvSet(key: string, value: unknown, exSeconds?: number): Promise<void> {
  const payload = JSON.stringify(value);
  if (isMemMode()) {
    memSet(key, payload, exSeconds);
    return;
  }
  // Upstash REST: /set/key/value[/EX/seconds]
  let path = `/set/${encodeURIComponent(key)}/${encodeURIComponent(payload)}`;
  if (exSeconds) path += `/EX/${exSeconds}`;
  await kvFetch(path, { method: "POST" });
}

export async function kvDel(key: string): Promise<void> {
  if (isMemMode()) { memDel(key); return; }
  await kvFetch(`/del/${encodeURIComponent(key)}`, { method: "POST" });
}

export async function kvLpush(key: string, value: unknown): Promise<void> {
  if (isMemMode()) { memLpush(key, JSON.stringify(value)); return; }
  await kvFetch(`/lpush/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify([JSON.stringify(value)]),
  });
}

export async function kvLrange<T>(key: string, start = 0, stop = -1): Promise<T[]> {
  if (isMemMode()) {
    return memLrange(key, start, stop).map(item => {
      try { return JSON.parse(item) as T; } catch { return item as T; }
    });
  }
  const data = await kvFetch(`/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
  return (data.result ?? []).map((item: string) => {
    try { return JSON.parse(item) as T; } catch { return item as T; }
  });
}

export async function kvLpop<T>(key: string): Promise<T | null> {
  if (isMemMode()) {
    const raw = memLpop(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as T; }
  }
  const data = await kvFetch(`/lpop/${encodeURIComponent(key)}`, { method: "POST", body: JSON.stringify([]) });
  if (!data.result) return null;
  try { return JSON.parse(data.result) as T; } catch { return data.result as T; }
}

export async function kvKeys(pattern: string): Promise<string[]> {
  if (isMemMode()) {
    // In-memory: filter keys by simple glob pattern (only * wildcard)
    const regex = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return Array.from(memStore.keys()).filter(k => regex.test(k));
  }
  const data = await kvFetch(`/keys/${encodeURIComponent(pattern)}`);
  return data.result ?? [];
}

export function kvAvailable(): boolean {
  return true; // always available — uses in-memory fallback when env vars not set
}
