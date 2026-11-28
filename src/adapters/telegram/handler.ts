import type { CheckInput, CheckOutcome, LoopDeps } from "../../agent/loop.js";
import { alertFor, type AlertKind } from "../../core/alerts.js";
import { markCrashed, runAdmittedCheck } from "../../core/check.js";
import { admit, intake } from "../../core/gate.js";
import { decideById, introduce, listPending } from "../../core/senders.js";
import { setPaused } from "../../core/settings.js";
import { statusSummary } from "../../core/status.js";
import type { Db } from "../../db/client.js";
import { adminText, approvedWelcome, fixedReplies } from "../../replies/copy.js";
import { renderReply } from "../../replies/render.js";
import type { TelegramApi } from "./api.js";
import { parseUpdate, type TelegramUpdate } from "./update.js";

/** How long to wait for the rest of a burst before checking it. */
export const GATHER_MS = 5_000;

export interface HandlerDeps {
  db: Db;
  api: TelegramApi;
  secret: string;
  /** The admin's sender key ("tg:<id>"); always allowed. */
  adminKey?: string;
  agent: Pick<LoopDeps, "model" | "lookups">;
  /** Runs work after the webhook has answered Telegram (Vercel's waitUntil). */
  waitUntil: (work: Promise<unknown>) => void;
  sleep?: (ms: number) => Promise<void>;
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

/**
 * Handles one webhook update. The quick part (intake and any fixed reply)
 * happens before the webhook answers; the check itself runs afterwards in
 * `waitUntil`, after the gathering window. Button presses and admin
 * commands are only honoured from the admin's Telegram ID.
 */
export async function handleUpdate(update: TelegramUpdate, deps: HandlerDeps): Promise<void> {
  const parsed = parseUpdate(update);
  const log = deps.log ?? (() => {});

  if (parsed.type === "ignore") return log("ignored", { reason: parsed.reason });
  if (parsed.type === "button") return handleButton(parsed, deps);

  if (parsed.type === "command") {
    const isAdmin = !!deps.adminKey && parsed.sender.key === deps.adminKey;
    if (isAdmin && Object.hasOwn(adminCommands, parsed.command)) return adminCommands[parsed.command]!(deps, parsed.chatId);
    if (parsed.command !== "start" && parsed.command !== "help") return log("unknown_command");
    const { reply, newPendingId } = await introduce(deps.db, parsed.sender, { secret: deps.secret, adminKey: deps.adminKey });
    if (newPendingId) await newSender(deps, newPendingId, parsed.sender);
    if (reply) await bestEffort(log, "reply_failed", () => deps.api.sendMessage(parsed.chatId, fixedReplies[reply]));
    return;
  }

  // From here on the intake is committed, so a failed send is logged rather
  // than thrown: Telegram's redelivery would only be dropped as a duplicate,
  // and the admin would never be asked about a new sender.
  const taken = await intake(deps.db, parsed.forward, { secret: deps.secret });
  if (taken.outcome === "unknown_sender") await newSender(deps, taken.senderId, parsed.forward.sender);
  if (taken.reply) {
    const reply = taken.reply;
    await bestEffort(log, "reply_failed", () => deps.api.sendMessage(parsed.chatId, fixedReplies[reply]));
  }
  if (taken.outcome !== "queued") return log(taken.outcome);

  deps.waitUntil(
    checkBurst(deps, parsed.chatId, taken.senderId, taken.messageId!).catch((error: unknown) =>
      log("check_crashed", { error: error instanceof Error ? error.message : String(error) }),
    ),
  );
}

/** Runs a send whose failure shouldn't undo work already committed; logs it instead. */
async function bestEffort(log: NonNullable<HandlerDeps["log"]>, event: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    log(event, { error: error instanceof Error ? error.message : String(error) });
  }
}

// --- Admin ----------------------------------------------------------------

/** A new sender is pending: ask the admin about them, and raise the burst alert if due. */
async function newSender(deps: HandlerDeps, senderId: string, sender: { displayName?: string; username?: string }) {
  const log = deps.log ?? (() => {});
  await bestEffort(log, "admin_request_failed", () => askAdmin(deps, senderId, sender));
  await bestEffort(log, "alert_failed", async () => alertIf(deps, await alertFor(deps.db, "unknown_sender")));
}

function adminChatId(deps: HandlerDeps): number | null {
  return deps.adminKey ? Number(deps.adminKey.slice("tg:".length)) : null;
}

const decisionButtons = (senderId: string) => [
  [
    { text: adminText.approveButton, data: `approve:${senderId}` },
    { text: adminText.denyButton, data: `deny:${senderId}` },
  ],
];

/** Sends an alert to the admin, if one was raised. */
async function alertIf(deps: HandlerDeps, kind: AlertKind | null) {
  const chat = adminChatId(deps);
  if (kind && chat !== null) await deps.api.sendMessage(chat, adminText.alert[kind], { plain: true });
}

/** Tells the admin someone new wants in, with approve and deny buttons. */
async function askAdmin(deps: HandlerDeps, senderId: string, sender: { displayName?: string; username?: string }) {
  const chat = adminChatId(deps);
  if (chat === null) return;
  const who = { displayName: sender.displayName ?? null, username: sender.username ?? null };
  await deps.api.sendMessage(chat, adminText.newRequest(who), { plain: true, buttons: decisionButtons(senderId) });
}

async function handleButton(press: Extract<ReturnType<typeof parseUpdate>, { type: "button" }>, deps: HandlerDeps) {
  const log = deps.log ?? (() => {});
  if (!deps.adminKey || press.fromKey !== deps.adminKey) {
    await deps.api.answerButton(press.callbackId);
    return log("button_from_non_admin");
  }
  const match = /^(approve|deny):([0-9a-f-]{36})$/.exec(press.data);
  if (!match) return deps.api.answerButton(press.callbackId);

  const status = match[1] === "approve" ? "allowed" : "denied";
  const decided = await decideById(deps.db, match[2]!, status);
  if (!decided?.changed) {
    await deps.api.answerButton(press.callbackId, adminText.alreadyDecided);
    return;
  }
  await deps.api.editMessage(press.chatId, press.messageId, status === "allowed" ? adminText.approved(decided) : adminText.denied(decided));
  await deps.api.answerButton(press.callbackId);
  if (status === "allowed" && decided.contactRef) await deps.api.sendMessage(Number(decided.contactRef), approvedWelcome);
}

const adminCommands: Record<string, (deps: HandlerDeps, chatId: number) => Promise<void>> = {
  async pause(deps, chatId) {
    await setPaused(deps.db, true, { by: "admin" });
    await deps.api.sendMessage(chatId, adminText.paused, { plain: true });
  },
  async resume(deps, chatId) {
    await setPaused(deps.db, false, { by: "admin" });
    await deps.api.sendMessage(chatId, adminText.resumed, { plain: true });
  },
  async status(deps, chatId) {
    await deps.api.sendMessage(chatId, adminText.status(await statusSummary(deps.db)), { plain: true });
  },
  async pending(deps, chatId) {
    const waiting = await listPending(deps.db);
    if (waiting.length === 0) return deps.api.sendMessage(chatId, adminText.noPending, { plain: true });
    await deps.api.sendMessage(chatId, adminText.pendingHeader(waiting.length), { plain: true });
    for (const p of waiting) {
      await deps.api.sendMessage(chatId, adminText.newRequest(p), { plain: true, buttons: decisionButtons(p.id) });
    }
  },
};

/**
 * After the gathering window: if this handler's message is still the
 * sender's latest, admit the whole burst as one check, run it and reply.
 */
async function checkBurst(deps: HandlerDeps, chatId: number, senderId: string, messageId: string): Promise<void> {
  await (deps.sleep ?? sleep)(GATHER_MS);
  const admitted = await admit(deps.db, senderId, { asOf: messageId });
  if (admitted.reply) await deps.api.sendMessage(chatId, fixedReplies[admitted.reply]);
  if (admitted.outcome === "budget_exhausted") await alertIf(deps, await alertFor(deps.db, "budget_exhausted"));
  if (admitted.outcome !== "admitted") return;

  const check = { id: admitted.checkId!, senderId };
  let outcome: CheckOutcome;
  try {
    const input = await buildInput(deps.api, admitted.batch!);
    outcome = await runAdmittedCheck(deps.db, check, input, deps.agent);
  } catch (error) {
    // Record the failure first, then never leave someone waiting after "Checking…".
    await markCrashed(deps.db, check, error instanceof Error ? error.message.slice(0, 200) : "crashed");
    await deps.api.sendMessage(chatId, fixedReplies.checkFailed);
    await alertIf(deps, await alertFor(deps.db, "check_failed"));
    throw error;
  }
  // The check is recorded by now; a failure past this point is a delivery
  // problem, not a failed check, so it propagates without touching the row.
  await deps.api.sendMessage(chatId, renderReply(outcome));
  if (outcome.status === "failed") await alertIf(deps, await alertFor(deps.db, "check_failed"));
}

async function buildInput(api: TelegramApi, batch: NonNullable<Awaited<ReturnType<typeof admit>>["batch"]>): Promise<CheckInput> {
  const texts = batch.map((m) => m.text).filter((t): t is string => !!t);
  const images = await Promise.all(batch.flatMap((m) => m.mediaRefs).map((ref) => api.downloadImage(ref)));
  return { text: texts.length ? texts.join("\n\n") : undefined, images };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
