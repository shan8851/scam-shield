import type { CheckInput, LoopDeps } from "../../agent/loop";
import { runAdmittedCheck } from "../../core/check";
import { admit, intake } from "../../core/gate";
import { introduce } from "../../core/senders";
import type { Db } from "../../db/client";
import { fixedReplies } from "../../replies/copy";
import { renderReply } from "../../replies/render";
import type { TelegramApi } from "./api";
import { parseUpdate, type TelegramUpdate } from "./update";

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
 * `waitUntil`, after the gathering window.
 */
export async function handleUpdate(update: TelegramUpdate, deps: HandlerDeps): Promise<void> {
  const parsed = parseUpdate(update);
  const log = deps.log ?? (() => {});

  if (parsed.type === "ignore") return log("ignored", { reason: parsed.reason });

  if (parsed.type === "command") {
    if (parsed.command !== "start" && parsed.command !== "help") return log("unknown_command");
    const reply = await introduce(deps.db, parsed.sender, { secret: deps.secret, adminKey: deps.adminKey });
    if (reply) await deps.api.sendMessage(parsed.chatId, fixedReplies[reply]);
    return;
  }

  const taken = await intake(deps.db, parsed.forward, { secret: deps.secret });
  if (taken.reply) await deps.api.sendMessage(parsed.chatId, fixedReplies[taken.reply]);
  if (taken.outcome !== "queued") return log(taken.outcome);

  deps.waitUntil(
    checkBurst(deps, parsed.chatId, taken.senderId, taken.messageId!).catch((error: unknown) =>
      log("check_crashed", { error: error instanceof Error ? error.message : String(error) }),
    ),
  );
}

/**
 * After the gathering window: if this handler's message is still the
 * sender's latest, admit the whole burst as one check, run it and reply.
 */
async function checkBurst(deps: HandlerDeps, chatId: number, senderId: string, messageId: string): Promise<void> {
  await (deps.sleep ?? sleep)(GATHER_MS);
  const admitted = await admit(deps.db, senderId, { asOf: messageId });
  if (admitted.reply) await deps.api.sendMessage(chatId, fixedReplies[admitted.reply]);
  if (admitted.outcome !== "admitted") return;

  try {
    const input = await buildInput(deps.api, admitted.batch!);
    const outcome = await runAdmittedCheck(deps.db, { id: admitted.checkId!, senderId }, input, deps.agent);
    await deps.api.sendMessage(chatId, renderReply(outcome));
  } catch (error) {
    // Never leave someone waiting after "Checking…".
    await deps.api.sendMessage(chatId, fixedReplies.checkFailed);
    throw error;
  }
}

async function buildInput(api: TelegramApi, batch: NonNullable<Awaited<ReturnType<typeof admit>>["batch"]>): Promise<CheckInput> {
  const texts = batch.map((m) => m.text).filter((t): t is string => !!t);
  const images = await Promise.all(batch.flatMap((m) => m.mediaRefs).map((ref) => api.downloadImage(ref)));
  return { text: texts.length ? texts.join("\n\n") : undefined, images };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
