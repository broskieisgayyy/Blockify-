export function getOwnerIds(): Set<string> {
  const env = process.env.OWNER_IDS;
  const defaults = ["827864129501921281", "1355452864390103051"];
  const ids = new Set<string>(defaults);
  if (env) {
    for (const part of env.split(",")) {
      const id = part.trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

export function isOwner(userId: string): boolean {
  return getOwnerIds().has(userId);
}

export function requireOwner(userId: string): { ok: true } | { error: string } {
  if (!isOwner(userId)) return { error: "Owner only command." };
  return { ok: true };
}
