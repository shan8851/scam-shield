import { eq } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import type { ImageInput } from "../src/agent/loop";
import { fakeLookups } from "../src/agent/lookups";
import type { ModelClient } from "../src/agent/model";
import type { TelegramApi } from "../src/adapters/telegram/api";
import { handleUpdate, type HandlerDeps } from "../src/adapters/telegram/handler";
import { parseUpdate, type TelegramUpdate } from "../src/adapters/telegram/update";
import { allowSender } from "../src/core/senders";
import { hashSender } from "../src/core/identity";
import type { Db } from "../src/db/client";
import { auditLog, checks, senders } from "../src/db/schema";
import { adminText, approvedWelcome, fixedReplies } from "../src/replies/copy";
import { freshDb, secret } from "./helpers";

const ALICE = 111;
const ADMIN = 999;
let updateId = 1000;

function message(from: number, over: Record<string, unknown> = {}): TelegramUpdate {
  return {
    update_id: ++updateId,
    message: {
      message_id: updateId,
      date: 1_795_400_000,
      chat: { id: from, type: "private" },
      from: { id: from, first_name: "Test", username: `user${from}` },
      ...over,
    },
  } as TelegramUpdate;
}

/** A model that always calls submit_verdict straight away, and counts the images it was shown. */
function verdictModel(): ModelClient & { imagesSeen: number[] } {
  const imagesSeen: number[] = [];
  return {
    imagesSeen,
    async create(request) {
      const first = request.messages[0]!.content as Anthropic.Beta.BetaContentBlockParam[];
      imagesSeen.push(first.filter((b) => b.type === "image").length);
      return {
        model: "claude-sonnet-5-5",
        stop_reason: "tool_use",
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [{ type: "tool_use", id: "tu_1", name: "submit_verdict", input: { verdict: "likely_scam", signals: ["urgency"], impersonating: "royal_mail", next_step: "dont_reply" } }],
      } as unknown as Anthropic.Beta.BetaMessage;
    },
  };
}

let db: Db;
let sent: { chatId: number; text: string; buttons?: { text: string; data: string }[][] }[];
let edits: { chatId: number; text: string }[];
let pending: Promise<unknown>[];
let windows: (() => void)[];
let model: ReturnType<typeof verdictModel>;
let deps: HandlerDeps;

const api: TelegramApi = {
  async sendMessage(chatId, text, opts) {
    sent.push({ chatId, text, ...(opts?.buttons ? { buttons: opts.buttons } : {}) });
  },
  async editMessage(chatId, _messageId, text) {
    edits.push({ chatId, text });
  },
  async answerButton() {},
  async downloadImage(): Promise<ImageInput> {
    return { mediaType: "image/jpeg", data: "aGk=" };
  },
};

async function deliver(update: TelegramUpdate) {
  await handleUpdate(update, deps);
}
/** Closes every open gathering window, then waits for the checks to finish. */
const settle = async () => {
  for (const close of windows.splice(0)) close();
  await Promise.all(pending);
  pending = [];
};

beforeEach(async () => {
  db = await freshDb();
  sent = [];
  edits = [];
  pending = [];
  windows = [];
  model = verdictModel();
  deps = {
    db,
    api,
    secret,
    adminKey: `tg:${ADMIN}`,
    agent: { model, lookups: fakeLookups({}) },
    waitUntil: (p) => pending.push(p),
    // The gathering window stays open until the test calls settle().
    sleep: () => new Promise<void>((resolve) => windows.push(resolve)),
  };
  await allowSender(db, `tg:${ALICE}`, { secret });
});

describe("parsing Telegram updates", () => {
  it("ignores group chats and other bots", () => {
    expect(parseUpdate(message(ALICE, { chat: { id: -5, type: "group" }, text: "hi" })).type).toBe("ignore");
    expect(parseUpdate(message(ALICE, { from: { id: 7, is_bot: true }, text: "hi" })).type).toBe("ignore");
  });

  it("takes the largest photo size, the caption as text, and the forwarded flag", () => {
    const parsed = parseUpdate(message(ALICE, { photo: [{ file_id: "small" }, { file_id: "large" }], caption: "is this real?", forward_origin: { type: "user" } }));
    expect(parsed).toMatchObject({ type: "forward", forward: { kind: "image", mediaRefs: ["large"], text: "is this real?", forwarded: true } });
  });

  it("treats a screenshot sent as a file as an image, and other files as documents", () => {
    expect(parseUpdate(message(ALICE, { document: { file_id: "f", mime_type: "image/png" } }))).toMatchObject({ forward: { kind: "image" } });
    expect(parseUpdate(message(ALICE, { document: { file_id: "f", mime_type: "application/pdf" } }))).toMatchObject({ forward: { kind: "document" } });
  });

  it("reads /start as a command, but a forwarded message starting with / as content", () => {
    expect(parseUpdate(message(ALICE, { text: "/start" }))).toMatchObject({ type: "command", command: "start" });
    expect(parseUpdate(message(ALICE, { text: "/claim your prize", forward_origin: { type: "user" } })).type).toBe("forward");
  });
});

describe("the webhook handler", () => {
  it("checks an allowed sender's message: 'Checking…', then the rendered verdict", async () => {
    await deliver(message(ALICE, { text: "Royal Mail: pay £1.99 now" }));
    await settle();
    expect(sent.map((s) => s.text)).toEqual([fixedReplies.checking, expect.stringContaining("Likely a scam")]);
  });

  it("checks a burst of three screenshots as one check, with every image", async () => {
    for (const id of ["a", "b", "c"]) await deliver(message(ALICE, { photo: [{ file_id: id }] }));
    await settle();
    expect(await db.select().from(checks)).toHaveLength(1);
    expect(model.imagesSeen).toEqual([3]);
    expect(sent.filter((s) => s.text === fixedReplies.checking)).toHaveLength(1);
  });

  it("answers a stranger once, then stays silent", async () => {
    await deliver(message(222, { text: "hello" }));
    await deliver(message(222, { text: "hello??" }));
    await settle();
    expect(sent.filter((s) => s.chatId === 222)).toEqual([{ chatId: 222, text: fixedReplies.inviteOnly }]);
  });

  it("ignores a redelivered update", async () => {
    const update = message(ALICE, { text: "hi" });
    await deliver(update);
    await deliver(update);
    await settle();
    expect(await db.select().from(checks)).toHaveLength(1);
  });

  it("welcomes an allowed sender on /start, and makes the admin allowed", async () => {
    await deliver(message(ALICE, { text: "/start" }));
    await deliver(message(ADMIN, { text: "/start" }));
    await deliver(message(ADMIN, { text: "is this a scam?" }));
    await settle();
    expect(sent.map((s) => s.text)).toEqual([fixedReplies.welcome, fixedReplies.welcome, fixedReplies.checking, expect.stringContaining("Likely a scam")]);
  });

  it("never leaves someone waiting: a crash after 'Checking…' sends the failure reply", async () => {
    deps.agent = { model: { create: async () => { throw new Error("boom"); } }, lookups: fakeLookups({}) };
    deps.api = { ...api, downloadImage: async () => { throw new Error("download failed"); } };
    await deliver(message(ALICE, { photo: [{ file_id: "x" }] }));
    await settle();
    expect(sent.map((s) => s.text)).toEqual([fixedReplies.checking, fixedReplies.checkFailed]);
  });
});

describe("the webhook handler when Telegram fails", () => {
  it("keeps a finished check as done when delivering the verdict fails", async () => {
    deps.api = {
      ...api,
      async sendMessage(chatId, text, opts) {
        if (text.includes("Likely a scam")) throw new Error("bot was blocked by the user");
        return api.sendMessage(chatId, text, opts);
      },
    };
    await deliver(message(ALICE, { text: "Royal Mail: pay £1.99 at https://rm-redeliver.top" }));
    await settle();
    const [check] = await db.select().from(checks);
    expect(check?.status).toBe("done");
    expect(sent.map((s) => s.text)).toEqual([fixedReplies.checking]);
    const events = (await db.select().from(auditLog)).map((a) => a.event);
    expect(events).toContain("check_done");
    expect(events).not.toContain("check_failed");
  });

  it("still asks the admin about a stranger when replying to the stranger fails", async () => {
    deps.api = {
      ...api,
      async sendMessage(chatId, text, opts) {
        if (chatId === 666) throw new Error("chat not found");
        return api.sendMessage(chatId, text, opts);
      },
    };
    await expect(deliver(message(666, { text: "hello", from: { id: 666, first_name: "Robin" } }))).resolves.toBeUndefined();
    expect(toAdmin()[0]?.text).toBe("New request: Robin wants to use the bot.");
  });

  it("still answers a stranger when asking the admin fails", async () => {
    deps.api = {
      ...api,
      async sendMessage(chatId, text, opts) {
        if (chatId === ADMIN) throw new Error("admin chat unavailable");
        return api.sendMessage(chatId, text, opts);
      },
    };
    await expect(deliver(message(667, { text: "hello" }))).resolves.toBeUndefined();
    expect(sent).toEqual([{ chatId: 667, text: fixedReplies.inviteOnly }]);
  });
});

function press(from: number, data: string): TelegramUpdate {
  return {
    update_id: ++updateId,
    callback_query: { id: `cb${updateId}`, from: { id: from }, data, message: { message_id: 1, chat: { id: from } } },
  } as TelegramUpdate;
}

const toAdmin = () => sent.filter((s) => s.chatId === ADMIN);

describe("admin controls", () => {
  it("asks the admin about a stranger, and welcomes them once approved", async () => {
    await deliver(message(333, { text: "hello", from: { id: 333, first_name: "Robin", username: "robin_k" } }));
    const [ask] = toAdmin();
    expect(ask?.text).toBe("New request: Robin (@robin_k) wants to use the bot.");
    const approve = ask!.buttons![0]![0]!.data;
    expect(approve).toMatch(/^approve:/);

    await deliver(press(ADMIN, approve));
    expect(edits).toEqual([{ chatId: ADMIN, text: "✅ Approved Robin (@robin_k)." }]);
    expect(sent.at(-1)).toEqual({ chatId: 333, text: approvedWelcome });

    await deliver(message(333, { text: "is this real?", from: { id: 333, first_name: "Robin" } }));
    await settle();
    expect(sent.at(-1)?.text).toContain("Likely a scam");
  });

  it("ignores button presses from anyone but the admin", async () => {
    await deliver(message(444, { text: "hello" }));
    const approve = toAdmin()[0]!.buttons![0]![0]!.data;
    await deliver(press(444, approve));
    expect(edits).toEqual([]);
    await deliver(message(444, { text: "let me in" }));
    expect(sent.filter((s) => s.chatId === 444)).toHaveLength(1);
  });

  it("denies quietly, and a second press on the same request does nothing", async () => {
    await deliver(message(555, { text: "hello", from: { id: 555, first_name: "Spam" } }));
    const deny = toAdmin()[0]!.buttons![0]![1]!.data;
    await deliver(press(ADMIN, deny));
    await deliver(press(ADMIN, deny));
    expect(edits).toEqual([{ chatId: ADMIN, text: "❌ Denied Spam." }]);
    expect(sent.filter((s) => s.chatId === 555)).toHaveLength(1);
  });

  it("ignores a stale button: denying someone already approved changes nothing", async () => {
    await deliver(message(556, { text: "hello", from: { id: 556, first_name: "Kim" } }));
    const [approve, deny] = toAdmin()[0]!.buttons![0]!.map((b) => b.data);
    await deliver(press(ADMIN, approve!));
    await deliver(press(ADMIN, deny!));
    expect(edits).toEqual([{ chatId: ADMIN, text: "✅ Approved Kim." }]);
    const [row] = await db.select().from(senders).where(eq(senders.senderHash, hashSender("tg:556", secret)));
    expect(row?.status).toBe("allowed");
    const decisions = (await db.select().from(auditLog)).filter((a) => a.senderId === row!.id && a.event !== "unknown_sender");
    expect(decisions.map((a) => a.event)).toEqual(["sender_allowed"]);
  });

  it("treats an admin command named after an object property as unknown", async () => {
    await expect(deliver(message(ADMIN, { text: "/constructor" }))).resolves.toBeUndefined();
    await expect(deliver(message(ADMIN, { text: "/__proto__" }))).resolves.toBeUndefined();
  });

  it("pauses and resumes checks, telling senders once while paused", async () => {
    await deliver(message(ADMIN, { text: "/pause" }));
    expect(toAdmin().at(-1)?.text).toBe(adminText.paused);
    await deliver(message(ALICE, { text: "check this" }));
    await deliver(message(ALICE, { text: "and this" }));
    await settle();
    expect(sent.filter((s) => s.chatId === ALICE).map((s) => s.text)).toEqual([fixedReplies.paused]);
    expect(await db.select().from(checks)).toHaveLength(0);

    await deliver(message(ADMIN, { text: "/resume" }));
    await deliver(message(ALICE, { text: "check this now" }));
    await settle();
    expect(sent.at(-1)?.text).toContain("Likely a scam");
  });

  it("only answers admin commands from the admin", async () => {
    await deliver(message(ALICE, { text: "/pause" }));
    await deliver(message(ALICE, { text: "is this a scam?" }));
    await settle();
    expect(sent.at(-1)?.text).toContain("Likely a scam");
  });

  it("lists who's waiting, with buttons, and reports status", async () => {
    await deliver(message(666, { text: "hi", from: { id: 666, first_name: "Kim" } }));
    sent = [];
    await deliver(message(ADMIN, { text: "/pending" }));
    expect(toAdmin().map((s) => s.text)).toEqual([adminText.pendingHeader(1), "New request: Kim wants to use the bot."]);
    await deliver(message(ADMIN, { text: "/status" }));
    expect(toAdmin().at(-1)?.text).toContain("People: 1 allowed, 1 waiting");
  });
});

describe("alerts to the admin", () => {
  it("alerts once when a third stranger turns up within the hour", async () => {
    for (const id of [701, 702, 703, 704]) await deliver(message(id, { text: "hi" }));
    expect(toAdmin().filter((s) => s.text === adminText.alert.stranger_burst)).toHaveLength(1);
  });

  it("marks a crashed check as failed, and alerts after three in a row", async () => {
    deps.api = { ...api, downloadImage: async () => { throw new Error("download failed"); } };
    for (let i = 0; i < 3; i++) {
      await deliver(message(ALICE, { photo: [{ file_id: `x${i}` }] }));
      await settle();
    }
    expect((await db.select().from(checks)).every((c) => c.status === "failed")).toBe(true);
    expect(toAdmin().filter((s) => s.text === adminText.alert.failures_in_a_row)).toHaveLength(1);
  });
});
