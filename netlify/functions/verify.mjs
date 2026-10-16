import { getStore } from "@netlify/blobs";
import { POTLUCK, PENDING_HOLD_MS, esc, sendEmail, emailShell } from "../lib/shared.mjs";

const page = (title, body) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Creepster&family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<style>body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,#3b1660,#14081f 70%);color:#f5ecff;font-family:Nunito,sans-serif;display:grid;place-items:center;padding:16px}
.card{max-width:520px;width:100%;background:#221035;border:2px solid #ff7a1a;border-radius:20px;padding:28px;box-shadow:0 0 40px #ff7a1a33}
h1{font-family:Creepster,cursive;color:#ff7a1a;font-size:42px;margin:0 0 10px;letter-spacing:1px}.addr{background:#14081f;border-radius:12px;padding:16px;font-size:20px;font-weight:800;color:#ffd166;margin:16px 0}
li{margin:4px 0}a{color:#b6ff5c}</style></head><body><div class="card">${body}</div></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });

export default async (req) => {
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!/^[a-f0-9]{48}$/.test(token)) return page("Link not valid", `<h1>Hmm…</h1><p>That confirmation link isn't valid. Please use the button in your email.</p>`);
  const store = getStore({ name: "party", consistency: "strong" });
  const r = await store.get(`reg/${token}`, { type: "json" });
  if (!r) return page("Link not valid", `<h1>Hmm…</h1><p>We couldn't find that registration. Please sign up again.</p><p><a href="/">Back to the sign-up</a></p>`);
  if (r.status === "pending" && Date.now() - r.created > PENDING_HOLD_MS)
    return page("Link expired", `<h1>Link expired</h1><p>This link was older than 48 hours, so the potluck hold was released. Please sign up again.</p><p><a href="/">Back to the sign-up</a></p>`);

  const label = (id) => POTLUCK.find((p) => p.id === id)?.label || "";
  const list = r.attendees.map((p) => `<li>${esc(p.name)} (${p.type})${p.bring ? ` – bringing <b>${esc(label(p.bring))}</b>` : ""}</li>`).join("");
  const address = process.env.PARTY_ADDRESS || "The host will send the address shortly.";
  const when = process.env.PARTY_WHEN || "";
  const details = `${when ? `<p><b>When:</b> ${esc(when)}</p>` : ""}<p><b>Where:</b></p><div class="addr" style="background:#14081f;border-radius:12px;padding:16px;font-size:18px;font-weight:bold;color:#ffd166">${esc(address)}</div><p><b>Your group:</b></p><ul>${list}</ul><p>Adults, costumes are encouraged! 🧛</p>`;

  if (r.status !== "verified") {
    r.status = "verified";
    r.verifiedAt = Date.now();
    await store.setJSON(`reg/${token}`, r);
    await sendEmail({ to: r.attendees[0].email, subject: "You're registered! Party details inside 🎃", html: emailShell(`<p>Hi ${esc(r.contactName)}, you're all set!</p>${details}<p style="font-size:13px;color:#cbb6e6">This is a private home, so please don't share the address.</p>`) });
  }
  return page("You're registered!", `<h1>You're in! 🎃</h1><p>Thanks, ${esc(r.contactName)}. Your registration is confirmed and we've emailed you these details too.</p>${details}<p style="font-size:14px;opacity:.8">This is a private home, so please keep the address to your group.</p>`);
};

export const config = { path: "/api/verify" };
