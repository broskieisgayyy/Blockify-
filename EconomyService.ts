import { EconomyStore } from "./EconomyStore";

export class EconomyService {
  constructor(private store = new EconomyStore()) {}

  /** Atomically subtracts amount if user has enough balance. */
  async debitIfEnough(
    userId: string,
    amount: number
  ): Promise<{ ok: true; balance: number } | { error: string }> {
    const amt = sanitizeAmount(amount);
    if (amt <= 0) return { error: "Amount must be at least 1." };

    let ok = true;
    await this.store.write((s) => {
      const bal = s.balances[userId] ?? 0;
      if (bal < amt) {
        ok = false;
        return;
      }
      s.balances[userId] = Math.max(0, Math.floor(bal - amt));
    });

    if (!ok) return { error: "Insufficient balance." };
    return { ok: true, balance: await this.getBalance(userId) };
  }

  async getBalance(userId: string): Promise<number> {
    const d = await this.store.read();
    return Math.max(0, Math.floor(d.balances[userId] ?? 0));
  }

  async add(userId: string, amount: number): Promise<number> {
    const amt = sanitizeAmount(amount);
    const d = await this.store.write((s) => {
      s.balances[userId] = Math.max(0, Math.floor((s.balances[userId] ?? 0) + amt));
    });
    return d.balances[userId] ?? 0;
  }

  async take(userId: string, amount: number): Promise<number> {
    const amt = sanitizeAmount(amount);
    const d = await this.store.write((s) => {
      s.balances[userId] = Math.max(0, Math.floor((s.balances[userId] ?? 0) - amt));
    });
    return d.balances[userId] ?? 0;
  }

  async set(userId: string, amount: number): Promise<number> {
    const amt = Math.max(0, Math.floor(amount));
    const d = await this.store.write((s) => {
      s.balances[userId] = amt;
    });
    return d.balances[userId] ?? 0;
  }

  async pay(payerId: string, recipientId: string, amount: number): Promise<{ payer: number; recipient: number } | { error: string }>{
    const amt = sanitizeAmount(amount);
    if (payerId === recipientId) return { error: "You can't pay yourself." };
    if (amt <= 0) return { error: "Amount must be at least 1." };

    const now = Date.now();
    const d = await this.store.read();
    const last = d.payLimits[payerId]?.[recipientId] ?? 0;
    const diff = now - last;
    const limitMs = 24 * 60 * 60 * 1000;
    if (diff < limitMs) {
      const hours = Math.ceil((limitMs - diff) / (60 * 60 * 1000));
      return { error: `You can pay this user again in ~${hours}h.` };
    }
    const payerBal = d.balances[payerId] ?? 0;
    if (payerBal < amt) return { error: "Insufficient balance." };

    const updated = await this.store.write((s) => {
      s.balances[payerId] = Math.max(0, Math.floor((s.balances[payerId] ?? 0) - amt));
      s.balances[recipientId] = Math.max(0, Math.floor((s.balances[recipientId] ?? 0) + amt));
      s.payLimits[payerId] ??= {};
      s.payLimits[payerId][recipientId] = now;
    });

    return {
      payer: updated.balances[payerId] ?? 0,
      recipient: updated.balances[recipientId] ?? 0,
    };
  }

  async claimDaily(userId: string): Promise<{ reward: number; streak: number; balance: number } | { error: string }>{
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const graceMs = 48 * 60 * 60 * 1000;
    const d = await this.store.read();

    const entry = d.daily[userId] ?? { streak: 0, lastClaimAt: 0 };
    const since = now - entry.lastClaimAt;

    if (since < dayMs) {
      const hours = Math.ceil((dayMs - since) / (60 * 60 * 1000));
      return { error: `You already claimed daily. Try again in ~${hours}h.` };
    }

    let streak = entry.streak;
    if (entry.lastClaimAt === 0) {
      streak = 1;
    } else if (since <= graceMs) {
      streak = streak + 1;
    } else {
      streak = 1;
    }

    const reward = 1 + (streak - 1); // +1 per streak day

    const updated = await this.store.write((s) => {
      s.daily[userId] = { streak, lastClaimAt: now };
      s.balances[userId] = Math.max(0, Math.floor((s.balances[userId] ?? 0) + reward));
    });

    return { reward, streak, balance: updated.balances[userId] ?? 0 };
  }

  async createCode(codeRaw: string, creditz: number, expiryHours?: number) {
    const code = normalizeCode(codeRaw);
    const amt = sanitizeAmount(creditz);
    const expiresAt = expiryHours ? Date.now() + expiryHours * 60 * 60 * 1000 : undefined;
    await this.store.write((s) => {
      s.codes[code] = { creditz: amt, createdAt: Date.now(), ...(expiresAt ? { expiresAt } : {}) };
    });
    return { code, creditz: amt, expiresAt };
  }

  async expireCode(codeRaw: string): Promise<{ ok: true } | { error: string }>{
    const code = normalizeCode(codeRaw);
    const d = await this.store.read();
    if (!d.codes[code]) return { error: "Code not found." };
    await this.store.write((s) => {
      s.codes[code].expired = true;
    });
    return { ok: true };
  }

  async useCode(userId: string, codeRaw: string): Promise<{ creditz: number; balance: number } | { error: string }>{
    const code = normalizeCode(codeRaw);
    const d = await this.store.read();
    const entry = d.codes[code];
    if (!entry) return { error: "Invalid code." };
    if (entry.expired) return { error: "This code is expired." };
    if (entry.expiresAt && Date.now() > entry.expiresAt) return { error: "This code has expired." };
    if (entry.claimedBy) return { error: "This code has already been claimed." };

    const updated = await this.store.write((s) => {
      const e = s.codes[code];
      e.claimedBy = userId;
      e.claimedAt = Date.now();
      s.balances[userId] = Math.max(0, Math.floor((s.balances[userId] ?? 0) + e.creditz));
    });

    return { creditz: entry.creditz, balance: updated.balances[userId] ?? 0 };
  }

  async getLeaderboard(limit = 10): Promise<Array<{ userId: string; balance: number }>> {
    const d = await this.store.read();
    return Object.entries(d.balances)
      .map(([userId, balance]) => ({ userId, balance: Math.max(0, Math.floor(balance)) }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);
  }

  async trackCommand(name: string, ms: number, ok: boolean) {
    await this.store.write((s) => {
      s.analytics.commands[name] ??= { uses: 0, totalMs: 0, errors: 0 };
      s.analytics.commands[name].uses += 1;
      s.analytics.commands[name].totalMs += Math.max(0, Math.floor(ms));
      if (!ok) s.analytics.commands[name].errors += 1;
    });
  }
}

function sanitizeAmount(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeCode(code: string) {
  return String(code).trim().toUpperCase();
}
