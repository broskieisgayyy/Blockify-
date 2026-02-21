import fs from "node:fs/promises";
import path from "node:path";

export type EconomyData = {
  version: 1;
  balances: Record<string, number>;
  daily: Record<string, { streak: number; lastClaimAt: number }>; // ms epoch
  payLimits: Record<string, Record<string, number>>; // payer -> recipient -> lastPaidAt
  codes: Record<
    string,
    {
      creditz: number;
      createdAt: number;
      expiresAt?: number;
      expired?: boolean;
      claimedBy?: string;
      claimedAt?: number;
    }
  >;
  analytics: {
    commands: Record<string, { uses: number; totalMs: number; errors: number }>;
  };
};

const DEFAULT_DATA: EconomyData = {
  version: 1,
  balances: {},
  daily: {},
  payLimits: {},
  codes: {},
  analytics: { commands: {} },
};

export class EconomyStore {
  private filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath = path.resolve(process.cwd(), "data", "economy.json")) {
    this.filePath = filePath;
  }

  async read(): Promise<EconomyData> {
    await this.ensure();
    const raw = await fs.readFile(this.filePath, "utf8");
    try {
      const parsed = JSON.parse(raw) as EconomyData;
      return { ...DEFAULT_DATA, ...parsed, analytics: { ...DEFAULT_DATA.analytics, ...(parsed.analytics ?? {}) } };
    } catch {
      return { ...DEFAULT_DATA };
    }
  }

  async write(mutator: (d: EconomyData) => void): Promise<EconomyData> {
    this.writeQueue = this.writeQueue.then(async () => {
      const d = await this.read();
      mutator(d);
      await this.ensure();
      await fs.writeFile(this.filePath, JSON.stringify(d, null, 2), "utf8");
    });
    await this.writeQueue;
    return this.read();
  }

  private async ensure() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify(DEFAULT_DATA, null, 2), "utf8");
    }
  }
}
