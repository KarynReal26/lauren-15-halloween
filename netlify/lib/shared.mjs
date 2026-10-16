export const POTLUCK = [
  { id: "chips", label: "2 bags of chips", total: 4 },
  { id: "two-liters", label: "2-liter sodas (2)", total: 10 },
  { id: "cookies", label: "2 packs of cookies", total: 8 },
  { id: "soda-cases", label: "2 cases of soda", total: 10 },
  { id: "water", label: "Case of water", total: 20 },
  { id: "chocolate", label: "2 bags of chocolate candy", total: 25 },
  { id: "hard-candy", label: "2 bags of hard candy", total: 25 },
  { id: "cupcakes", label: "2 dozen cupcakes", total: 4 },
  { id: "sides", label: "Side dish (mac & cheese, green beans, baked beans, etc.)", total: 8 },
  { id: "mains", label: "Main dish (chicken, beef, ribs)", total: 4 },
  { id: "pizza", label: "Pizza", total: 20 },
];

export const PENDING_HOLD_MS = 48 * 60 * 60 * 1000;

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Count claimed potluck spots: verified registrations + pending ones still within the hold window
export async function countClaims(store) {
  const counts = Object.fromEntries(POTLUCK.map((p) => [p.id, 0]));
  const { blobs } = await store.list({ prefix: "reg/" });
  const now = Date.now();
  for (const b of blobs) {
    const r = await store.get(b.key, { type: "json" });
    if (!r) continue;
    const live = r.status === "verified" || (r.status === "pending" && now - r.created < PENDING_HOLD_MS);
    if (!live) continue;
    for (const p of r.attendees || []) if (p.bring && counts[p.bring] !== undefined) counts[p.bring]++;
  }
  return counts;
}

export async function sendEmail({ to, subject, html }) {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.SENDER_EMAIL;
  if (!key || !from) {
    console.log("Email not sent (BREVO_API_KEY / SENDER_EMAIL not set):", to, subject);
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: from, name: process.env.SENDER_NAME || "Lauren's 15th Halloween Party" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) console.log("Brevo error", res.status, await res.text());
  return res.ok;
}

export const emailShell = (inner) => `
<div style="background:#14081f;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#221035;border-radius:16px;padding:28px;color:#f5ecff;border:2px solid #ff7a1a">
    <div style="font-size:13px;letter-spacing:2px;color:#ffb86b;text-transform:uppercase">Lauren Crayton's</div>
    <div style="font-size:26px;font-weight:bold;color:#ff7a1a;margin:4px 0 18px">15th Halloween Birthday Party 🎃</div>
    ${inner}
  </div>
</div>`;
