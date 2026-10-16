import { getStore } from "@netlify/blobs";
import { POTLUCK, PENDING_HOLD_MS, esc, sendEmail, emailShell, pageShell } from "../lib/shared.mjs";

// Guest clicks the link in their email: proves the email is real, then waits for host approval
export default async (req) => {
  const token = new URL(req.url).searchParams.get("t") || "";
  const card = (b) => pageShell("Lauren's 15th Halloween Party", `<div class="card">${b}</div>`);
  if (!/^[a-f0-9]{48}$/.test(token)) return card(`<h1>Hmm…</h1><p>That confirmation link isn't valid. Please use the button in your email.</p>`);
  const store = getStore({ name: "party", consistency: "strong" });
  const r = await store.get(`reg/${token}`, { type: "json" });
  if (!r) return card(`<h1>Hmm…</h1><p>We couldn't find that registration. Please <a href="/">sign up again</a>.</p>`);
  if (r.status === "pending" && Date.now() - r.created > PENDING_HOLD_MS)
    return card(`<h1>Link expired</h1><p>This link was older than 48 hours, so your potluck spot was released. Please <a href="/">sign up again</a>.</p>`);
  if (r.status === "declined") return card(`<h1>Thanks!</h1><p>Your registration has been received.</p>`);
  if (r.status === "approved") return card(`<h1>You're approved! 🎃</h1><p>The party details were sent to your email. Check your inbox (and spam folder).</p>`);

  if (r.status === "pending") {
    r.status = "verified";
    r.verifiedAt = Date.now();
    await store.setJSON(`reg/${token}`, r);
    const label = (id) => POTLUCK.find((p) => p.id === id)?.label || "";
    const list = r.attendees.map((p) => `<li>${esc(p.name)} (${p.type})${p.email ? ` · ${esc(p.email)}` : ""}${p.phone ? ` · ${esc(p.phone)}` : ""}${p.bring ? ` · brings ${esc(label(p.bring))}` : ""}</li>`).join("");
    const base = process.env.URL || "https://lc-halloweenparty.netlify.app";
    if (process.env.HOST_EMAIL)
      await sendEmail({ to: process.env.HOST_EMAIL, subject: `New RSVP to review: ${r.contactName} (${r.headcount})`, html: emailShell(`
        <p><b>${esc(r.contactName)}</b> confirmed their email.</p><p>Organization: <b>${esc(r.organization)}</b><br>Party size: <b>${r.headcount}</b></p><ul>${list}</ul>
        <p style="text-align:center;margin:24px 0"><a href="${base}/host" style="background:#ff6fd2;color:#2a0620;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px;display:inline-block">Review &amp; approve</a></p>`) });
  }
  return card(`<h1>Email confirmed! ✅</h1><p>Thanks, ${esc(r.contactName)}. Your sign-up for Lauren's 15th Halloween Birthday Party is in.</p>
    <p>Because the party is at a private home, the host reviews each RSVP personally. <b>You'll get an email with the address once you're approved.</b></p>
    <p class="muted">Saturday, October 31 · 6:00 PM · Come as a twin! 👯</p>`);
};

export const config = { path: "/api/verify" };
