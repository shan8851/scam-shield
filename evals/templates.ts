import type { Screenshot } from "./types";

/**
 * HTML that imitates real phone screens, for rendering eval screenshots with
 * headless Chrome. Every template is used for genuine and scam cases alike,
 * so how a screenshot looks can never predict its label.
 */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

const base = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 390px; min-height: 844px; font-family: -apple-system, "SF Pro Text", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif; font-size: 16px; line-height: 1.35; }
  .status { height: 44px; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; font-weight: 600; font-size: 15px; }
  .bar { display: flex; align-items: center; gap: 12px; padding: 8px 14px 10px; border-bottom: 1px solid rgba(0,0,0,.08); }
  .avatar { width: 36px; height: 36px; border-radius: 50%; background: #c7ccd6; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; }
  .name { font-weight: 600; font-size: 16px; }
  .sub { font-size: 12px; opacity: .6; }
  .thread { padding: 12px 10px; display: flex; flex-direction: column; gap: 6px; }
  .bubble { max-width: 78%; padding: 8px 12px; border-radius: 18px; word-wrap: break-word; }
  a, .link { color: #0a66c2; text-decoration: underline; }
`;

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();

const linkify = (s: string) =>
  esc(s).replace(/(https?:\/\/[^\s<]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|co\.uk|uk|ai|app|io|me|org|net|xyz|info)(?:\/[^\s<]*)?)/gi, '<span class="link">$1</span>');

const page = (css: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${base}${css}</style></head><body>${body}</body></html>`;

const status = (dark = false) =>
  `<div class="status" style="color:${dark ? "#fff" : "#000"}"><span>09:41</span><span>●●●● 5G ▮</span></div>`;

export function renderTemplate(s: Screenshot): string {
  switch (s.template) {
    case "sms":
      return page(
        `body { background: #fff; } .them { background: #e9e9eb; align-self: flex-start; } .when { text-align: center; font-size: 12px; color: #8a8a8e; margin: 6px 0; }`,
        `${status()}<div class="bar" style="flex-direction:column;gap:4px"><div class="avatar">${initials(s.sender) || "#"}</div><div class="name" style="font-size:13px;font-weight:500">${esc(s.sender)} ›</div></div>
         <div class="thread"><div class="when">Text Message · Today 08:12</div>${s.messages.map((m) => `<div class="bubble them">${linkify(m)}</div>`).join("")}</div>`,
      );
    case "whatsapp":
      return page(
        `body { background: #efeae2; } .bar { background: #f6f6f6; } .them { background: #fff; align-self: flex-start; } .me { background: #d9fdd3; align-self: flex-end; } .bubble { border-radius: 8px; box-shadow: 0 1px 0 rgba(0,0,0,.08); }`,
        `${status()}<div class="bar"><span style="color:#007aff;font-size:22px">‹</span><div class="avatar">${initials(s.contact)}</div><div><div class="name">${esc(s.contact)}</div><div class="sub">online</div></div></div>
         <div class="thread">${s.messages.map((m) => `<div class="bubble ${m.from}">${linkify(m.text)}</div>`).join("")}</div>`,
      );
    case "email":
      return page(
        `body { background: #fff; } .hdr { padding: 12px 18px; } .subject { font-size: 21px; font-weight: 600; padding: 6px 18px 12px; } .body { padding: 6px 18px 24px; font-size: 15px; }`,
        `${status()}<div class="subject">${esc(s.subject)}</div>
         <div class="hdr" style="display:flex;gap:12px;align-items:center"><div class="avatar" style="background:#8e7cc3">${initials(s.fromName)}</div>
           <div><div class="name">${esc(s.fromName)}${s.verified ? ' <span style="color:#1a73e8">✔</span>' : ""}</div><div class="sub">${esc(s.fromAddress)} · to me</div></div></div>
         <div class="body">${linkify(s.body)}</div>`,
      );
    case "linkedin":
      return page(
        `body { background: #fff; } .msg { display: flex; gap: 10px; padding: 10px 14px; } .who { font-weight: 600; font-size: 15px; } .txt { font-size: 15px; }`,
        `${status()}<div class="bar"><span style="font-size:22px">←</span><div class="avatar" style="background:#5f7d95">${initials(s.name)}</div><div><div class="name">${esc(s.name)}</div><div class="sub">${esc(s.headline)}</div></div></div>
         ${s.messages.map((m) => `<div class="msg"><div class="avatar" style="width:32px;height:32px;font-size:12px;background:${m.from === "me" ? "#8a9a5b" : "#5f7d95"}">${initials(m.name)}</div><div><div class="who">${esc(m.name)}</div><div class="txt">${linkify(m.text)}</div></div></div>`).join("")}`,
      );
  }
}
