type Entry = { count: number; resetAt: number };

const hits = new Map<string, Entry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key);
  }
}, 60_000).unref?.();

/**
 * Rate limit simples em memória, por chave (ex.: IP + rota).
 * Interface pronta para trocar por Upstash/Redis no futuro.
 * Retorna true se permitido; false se estourou o limite.
 */
export async function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): Promise<boolean> {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
