const cacheKey = 'urban-tanker-state-cache';
const sessionKey = 'urban-tanker-cache-key';
const cacheTtlMs = 5 * 60 * 1000;

interface CacheRecord { expiresAt: number; iv: string; ciphertext: string; }

function encode(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function decode(value: string): Uint8Array { return Uint8Array.from(atob(value), character => character.charCodeAt(0)); }

async function getKey(): Promise<CryptoKey> {
  let encoded = sessionStorage.getItem(sessionKey);
  if (!encoded) {
    encoded = encode(crypto.getRandomValues(new Uint8Array(32)));
    sessionStorage.setItem(sessionKey, encoded);
  }
  return crypto.subtle.importKey('raw', decode(encoded).buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function namespacedCacheKey(namespace: string): string {
  return namespace === 'state' ? cacheKey : `urban-tanker-${encodeURIComponent(namespace)}-cache`;
}

async function saveEncrypted<T>(value: T, namespace: string, ttlMs = cacheTtlMs): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const record: CacheRecord = { expiresAt: Date.now() + ttlMs, iv: encode(iv), ciphertext: encode(new Uint8Array(encrypted)) };
  localStorage.setItem(namespacedCacheKey(namespace), JSON.stringify(record));
}

async function readEncrypted<T>(namespace: string): Promise<{ value?: T; expired: boolean }> {
  try {
    const raw = localStorage.getItem(namespacedCacheKey(namespace));
    if (!raw) return { expired: false };
    const record = JSON.parse(raw) as CacheRecord;
    if (record.expiresAt <= Date.now()) return { expired: true };
    const key = await getKey();
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(record.iv).buffer as ArrayBuffer }, key, decode(record.ciphertext).buffer as ArrayBuffer);
    return { value: JSON.parse(new TextDecoder().decode(plaintext)) as T, expired: false };
  } catch {
    return { expired: true };
  }
}

export function saveEncryptedState<T>(value: T, ttlMs = cacheTtlMs): Promise<void> { return saveEncrypted(value, 'state', ttlMs); }
export function readEncryptedState<T>(): Promise<{ value?: T; expired: boolean }> { return readEncrypted<T>('state'); }
export function saveEncryptedContent<T>(clientId: string, value: T, ttlMs = cacheTtlMs): Promise<void> { return saveEncrypted(value, `content-${clientId}`, ttlMs); }
export function readEncryptedContent<T>(clientId: string): Promise<{ value?: T; expired: boolean }> { return readEncrypted<T>(`content-${clientId}`); }
export function clearEncryptedState(): void { localStorage.removeItem(cacheKey); }
export { cacheTtlMs };
