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
    const live = r.status === "verified" || r.status === "approved" || (r.status === "pending" && now - r.created < PENDING_HOLD_MS);
    if (!live) continue;
    for (const p of r.attendees || []) if (p.bring && counts[p.bring] !== undefined) counts[p.bring]++;
  }
  return counts;
}

export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.SENDER_EMAIL;
  if (!key || !from) {
    console.log("Email not sent (RESEND_API_KEY / SENDER_EMAIL not set):", to, subject);
    return false;
  }
  const name = process.env.SENDER_NAME || "Lauren's 15th Halloween Party";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: `${name} <${from}>`, to: [to], subject, html }),
  });
  if (!res.ok) console.log("Resend error", res.status, await res.text());
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

export const pageShell = (title, body) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>body{margin:0;min-height:100vh;background:linear-gradient(180deg,#14081fb3,#14081fe6),url(/background.jpg) 62% 30%/cover fixed;color:#f5ecff;font-family:Nunito,sans-serif;padding:16px}
.wrap{max-width:640px;margin:24px auto}.card{background:#221035ee;border:1px solid #ffcf6b55;border-radius:20px;padding:22px;margin:14px 0;box-shadow:0 10px 30px #0006}
h1{font-family:"Permanent Marker",cursive;font-weight:400;color:#ff8ad8;font-size:2.1rem;margin:0 0 8px}h2{font-family:"Permanent Marker",cursive;font-weight:400;color:#ffcf6b;font-size:1.4rem;margin:22px 0 6px}
.addr{background:#14081f;border-radius:12px;padding:16px;font-size:1.2rem;font-weight:900;color:#ffcf6b;margin:14px 0}
a{color:#b6ff5c}ul{padding-left:20px}li{margin:3px 0}.muted{color:#cbb6e6;font-size:.9rem}
.btn{font:inherit;font-weight:900;border:0;border-radius:999px;padding:12px 20px;cursor:pointer;margin:8px 8px 0 0}.ok{background:linear-gradient(180deg,#ffb3e6,#ff6fd2);color:#2a0620}.no{background:#3a1d55;color:#f5ecff}
input{font:inherit;width:100%;padding:12px;border-radius:12px;border:2px solid #4a2a6b;background:#14081f;color:#f5ecff;box-sizing:border-box}
.pill{display:inline-block;font-size:.75rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px;border-radius:999px;background:#4a2a6b;margin-left:6px}
.stats{display:flex;gap:8px;flex-wrap:wrap}.stats div{background:#14081f;border-radius:12px;padding:8px 12px;font-weight:800}</style></head>
<body><div class="wrap">${body}</div></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
