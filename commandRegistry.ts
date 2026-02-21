import { Collection } from "discord.js";
import { helpCommand } from "../slash/help";
import { balanceCommand } from "../slash/economy/balance";
import { payCommand } from "../slash/economy/pay";
import { dailyCommand } from "../slash/economy/daily";
import { leaderboardCommand } from "../slash/economy/leaderboard";
import { useCodeCommand } from "../slash/economy/usecode";
import { addEcoCommand } from "../slash/economy/owner/addeco";
import { takeEcoCommand } from "../slash/economy/owner/takeeco";
import { setEcoCommand } from "../slash/economy/owner/seteco";
import { codeCreateCommand } from "../slash/economy/owner/codecreate";
import { expireCodeCommand } from "../slash/economy/owner/expire";
import { coinflipCommand } from "../slash/games/coinflip";
import { minesCommand } from "../slash/games/mines";
import { blackjackCommand } from "../slash/games/blackjack";

export async function loadCommands() {
  const commands = new Collection<string, any>();
  const all = [
    helpCommand,
    balanceCommand,
    payCommand,
    dailyCommand,
    leaderboardCommand,
    useCodeCommand,
    coinflipCommand,
    minesCommand,
    blackjackCommand,
    addEcoCommand,
    takeEcoCommand,
    setEcoCommand,
    codeCreateCommand,
    expireCodeCommand,
  ];

  for (const cmd of all) {
    // Chat input commands are keyed by name; select-menu handlers use customId.
    commands.set(cmd.data?.name ?? cmd.customId, cmd);
  }

  const commandData = all
    .filter((c) => c.data)
    .map((c) => c.data.toJSON());

  return { commands, commandData };
}
