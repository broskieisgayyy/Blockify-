const cooldowns = new Map<string, number>();

export function checkCooldown(key: string, cooldownMs: number): { ok: true } | { error: string } {
  const now = Date.now();
  const last = cooldowns.get(key) ?? 0;
  if (now - last < cooldownMs) {
    const secs = Math.ceil((cooldownMs - (now - last)) / 1000);
    return { error: `Slow down — try again in ${secs}s.` };
  }
  cooldowns.set(key, now);
  return { ok: true };
}
