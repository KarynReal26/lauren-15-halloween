import { getStore } from "@netlify/blobs";
import { POTLUCK, PENDING_HOLD_MS, esc, sendEmail, emailShell, pageShell, countClaims } from "../lib/shared.mjs";

const label = (id) => POTLUCK.find((p) => p.id === id)?.label || "";

async function sendAddress(r) {
  const address = process.env.PARTY_ADDRESS || "";
  const when = process.env.PARTY_WHEN || "Saturday, October 31, 2026 at 6:00 PM";
  const list = r.attendees.map((p) => `<li>${esc(p.name)} (${p.type})${p.bring ? ` – bringing <b>${esc(label(p.bring))}</b>` : ""}</li>`).join("");
  return sendEmail({
    to: r.attendees[0].email,
    subject: "You're approved! Party address inside 🎃",
    html: emailShell(`<p>Hi ${esc(r.contactName)}, you're all set for Lauren's party!</p>
      <p><b>When:</b> ${esc(when)}</p><p><b>Where:</b></p>
      <div style="background:#14081f;border-radius:12px;padding:16px;font-size:18px;font-weight:bold;color:#ffd166">${esc(address)}</div>
      <p><b>Your group:</b></p><ul>${list}</ul>
      <p>Come as a twin! Match with a friend, sibling, partner or group. 👯</p>
      <p style="font-size:13px;color:#cbb6e6">This is a private home, so please keep the address to your group.</p>`),
  });
}

export default async (req) => {
  const HOST_KEY = process.env.HOST_KEY;
  const url = new URL(req.url);
  let form = new URLSearchParams();
  if (req.method === "POST") form = new URLSearchParams(await req.text());
  const key = form.get("key") || url.searchParams.get("key") || "";
  if (!HOST_KEY || key !== HOST_KEY) {
    return pageShell("Host sign-in", `<div class="card"><h1>Host sign-in</h1>${key ? `<p style="color:#ff5d73;font-weight:800">That passcode didn't match.</p>` : ""}
      <form method="POST" action="/host"><input name="key" type="password" placeholder="Passcode" autocomplete="current-password" required><button class="btn ok" type="submit">Open RSVPs</button></form></div>`);
  }

  const store = getStore({ name: "party", consistency: "strong" });
  let notice = "";
  const action = form.get("action"), token = form.get("t") || "";
  if (action && /^[a-f0-9]{48}$/.test(token)) {
    const r = await store.get(`reg/${token}`, { type: "json" });
    if (r && action === "approve") {
      const sent = await sendAddress(r);
      r.status = "approved"; r.approvedAt = Date.now();
      await store.setJSON(`reg/${token}`, r);
      notice = sent ? `✅ Approved ${esc(r.contactName)} and emailed the address.` : `⚠️ Marked ${esc(r.contactName)} approved, but the email didn't send. Check the Resend domain.`;
    } else if (r && action === "decline") {
      r.status = "declined"; await store.setJSON(`reg/${token}`, r);
      notice = `Declined ${esc(r.contactName)}. Their potluck spot was released. No email was sent.`;
    }
  }

  const { blobs } = await store.list({ prefix: "reg/" });
  const regs = [];
  for (const b of blobs) { const r = await store.get(b.key, { type: "json" }); if (r) regs.push({ token: b.key.slice(4), ...r }); }
  regs.sort((a, b) => b.created - a.created);
  const now = Date.now();
  const groups = {
    review: regs.filter((r) => r.status === "verified"),
    approved: regs.filter((r) => r.status === "approved"),
    unconfirmed: regs.filter((r) => r.status === "pending" && now - r.created < PENDING_HOLD_MS),
    declined: regs.filter((r) => r.status === "declined"),
  };
  const fmt = (t) => new Date(t).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const btn = (r, action, text, cls) => `<form method="POST" action="/host" style="display:inline"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="t" value="${r.token}"><input type="hidden" name="action" value="${action}"><button class="btn ${cls}">${text}</button></form>`;
  const cardFor = (r, buttons) => `<div class="card"><b style="font-size:1.15rem">${esc(r.contactName)}</b><span class="pill">${esc(r.organization)}</span><span class="pill">${r.headcount} ${r.headcount === 1 ? "person" : "people"}</span>
    <ul>${r.attendees.map((p) => `<li><b>${esc(p.name)}</b> (${p.type})${p.email ? `<br><a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ""}${p.phone ? ` · <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ""}${p.bring ? `<br>🍽️ ${esc(label(p.bring))}` : ""}</li>`).join("")}</ul>
    <div class="muted">Signed up ${fmt(r.created)}</div>${buttons}</div>`;
  const totalPeople = (list) => list.reduce((n, r) => n + r.headcount, 0);
  const counts = await countClaims(store);

  return pageShell("Host · RSVPs", `<h1>Lauren's Party RSVPs</h1>
    ${notice ? `<div class="card" style="font-weight:800">${notice}</div>` : ""}
    <div class="stats"><div>✅ Approved: ${totalPeople(groups.approved)} people</div><div>👀 To review: ${groups.review.length}</div><div>📭 Unconfirmed: ${groups.unconfirmed.length}</div></div>
    <h2>Waiting for your approval</h2>${groups.review.map((r) => cardFor(r, btn(r, "approve", "Approve &amp; send address", "ok") + btn(r, "decline", "Decline", "no"))).join("") || `<p class="muted">Nobody waiting right now.</p>`}
    <h2>Approved</h2>${groups.approved.map((r) => cardFor(r, btn(r, "approve", "Resend address", "no"))).join("") || `<p class="muted">None yet.</p>`}
    <h2>Email not confirmed yet</h2><p class="muted">These people haven't clicked their email link. Their potluck pick is held for 48 hours.</p>${groups.unconfirmed.map((r) => cardFor(r, "")).join("") || `<p class="muted">None.</p>`}
    ${groups.declined.length ? `<h2>Declined</h2>${groups.declined.map((r) => cardFor(r, btn(r, "approve", "Approve after all", "no"))).join("")}` : ""}
    <h2>Potluck</h2><div class="card"><ul>${POTLUCK.map((p) => `<li>${esc(p.label)}: <b>${counts[p.id]}</b> of ${p.total}</li>`).join("")}</ul></div>`);
};

export const config = { path: "/host" };
