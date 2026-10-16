import { getStore, connectLambda } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { POTLUCK, esc, sendEmail, emailShell } from "../lib/shared.mjs";

// Runs automatically after each verified (captcha + spam-checked) Netlify Forms submission
export const handler = async (event) => {
  connectLambda(event);
  const { payload } = JSON.parse(event.body);
  if (payload.form_name !== "party-signup") return { statusCode: 200 };
  const d = payload.data || {};
  let attendees = [];
  try { attendees = JSON.parse(d.attendees_json || "[]"); } catch {}
  const valid = new Set(POTLUCK.map((p) => p.id));
  attendees = attendees.slice(0, 20).map((p) => ({
    type: p.type === "Kid" ? "Kid" : "Adult",
    name: String(p.name || "").slice(0, 100),
    email: String(p.email || "").slice(0, 150),
    phone: String(p.phone || "").slice(0, 40),
    bring: p.type !== "Kid" && valid.has(p.bring) ? p.bring : "",
  }));
  const contactEmail = attendees[0]?.email || d.email;
  if (!contactEmail) return { statusCode: 200 };

  const token = randomBytes(24).toString("hex");
  const store = getStore({ name: "party", consistency: "strong" });
  await store.setJSON(`reg/${token}`, {
    status: "pending",
    created: Date.now(),
    submissionId: payload.id,
    contactName: d.name,
    organization: d.organization,
    headcount: attendees.length,
    attendees,
  });

  const base = process.env.URL || "https://lauren-15-halloween.netlify.app";
  const link = `${base}/api/verify?t=${token}`;
  await sendEmail({
    to: contactEmail,
    subject: "Confirm your spot at Lauren's 15th Halloween Party 🎃",
    html: emailShell(`
      <p>Hi ${esc(d.name)},</p>
      <p>Thanks for signing up! Tap the button below to confirm your email and finish your registration. Your potluck pick is held for 48 hours.</p>
      <p style="text-align:center;margin:26px 0"><a href="${link}" style="background:#ff7a1a;color:#14081f;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:999px;display:inline-block">Confirm my registration</a></p>
      <p style="font-size:13px;color:#cbb6e6">The party address will be shown as soon as you confirm. If you didn't sign up, you can ignore this email.</p>`),
  });
  return { statusCode: 200 };
};
