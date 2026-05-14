// Web-Crypto-based password hashing utilities shared between the
// /api/auth/password and /api/auth/reset-password/confirm routes.
//
// Uses PBKDF2-SHA256 with 100k iterations. Salt is 16 random bytes,
// hex-encoded. Hash is 32 bytes (256 bits), hex-encoded.

export interface PasswordRecord {
  salt: string;
  hash: string;
}

export function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return hexEncode(bits);
}

export async function makeNewPasswordRecord(password: string): Promise<PasswordRecord> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = hexEncode(saltBytes.buffer);
  const hash = await hashPassword(password, salt);
  return { salt, hash };
}

export async function verifyPassword(
  password: string,
  record: PasswordRecord
): Promise<boolean> {
  const hash = await hashPassword(password, record.salt);
  return hash === record.hash;
}
