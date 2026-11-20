import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { desc } from "drizzle-orm";
import { closePglite, openPglite } from "../../db/client";
import { auditLog } from "../../db/schema";
import type { Forward, ForwardKind } from "../../core/forward";
import { gate } from "../../core/gate";
import { senderHashSecret } from "../../core/identity";
import { replies } from "../../core/replies";
import { allowSender, denySender, listPending } from "../../core/senders";

/**
 * The CLI channel adapter: drives the core the same way the WhatsApp adapter
 * will, against a local PGlite database. Used for local runs now and by the
 * eval later.
 */
const usage = `Usage:
  pnpm cli send --from <number> [--kind text|image|voice|document|video|other] [--id <message-id>] [--name <profile name>] "<text>"
  pnpm cli allow <number> [--nickname <name>]
  pnpm cli deny <number>
  pnpm cli pending
  pnpm cli audit [--limit <n>]

Use Ofcom's drama numbers for testing, e.g. 07700900001.`;

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the environment.
}

const [command, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    from: { type: "string" },
    kind: { type: "string", default: "text" },
    id: { type: "string" },
    name: { type: "string" },
    nickname: { type: "string" },
    limit: { type: "string", default: "20" },
  },
});

const db = await openPglite(process.env.PGLITE_DATA_DIR ?? ".data/pglite");

switch (command) {
  case "send": {
    if (!values.from) throw new Error(usage);
    const forward: Forward = {
      externalId: values.id ?? `cli-${randomUUID()}`,
      senderNumber: values.from,
      senderProfileName: values.name,
      kind: values.kind as ForwardKind,
      text: positionals.join(" ") || undefined,
      receivedAt: new Date(),
    };
    const result = await gate(db, forward, { secret: senderHashSecret() });
    console.log(`gate: ${result.outcome}`);
    console.log(result.reply ? `reply: ${replies[result.reply]}` : "reply: (silence)");
    if (result.checkId) console.log(`check: ${result.checkId} (no agent yet: stops here)`);
    break;
  }
  case "allow": {
    const [number] = positionals;
    if (!number) throw new Error(usage);
    await allowSender(db, number, { secret: senderHashSecret(), nickname: values.nickname });
    console.log("allowed");
    break;
  }
  case "deny": {
    const [number] = positionals;
    if (!number) throw new Error(usage);
    await denySender(db, number, { secret: senderHashSecret() });
    console.log("denied");
    break;
  }
  case "pending": {
    const rows = await listPending(db);
    if (rows.length === 0) console.log("No one waiting.");
    for (const r of rows) {
      console.log(`…${r.last4}  ${r.profileName ?? "(no name)"}  since ${r.since.toISOString()}`);
    }
    break;
  }
  case "audit": {
    const rows = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.id))
      .limit(Number(values.limit));
    for (const r of rows.reverse()) {
      console.log(`${r.at.toISOString()}  ${r.event.padEnd(16)}  ${r.senderId ?? "-"}  ${JSON.stringify(r.detail ?? {})}`);
    }
    break;
  }
  default:
    console.log(usage);
}

await closePglite(db);
