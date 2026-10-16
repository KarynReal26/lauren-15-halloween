import { getStore } from "@netlify/blobs";
import { POTLUCK, countClaims } from "../lib/shared.mjs";

export default async () => {
  const counts = await countClaims(getStore({ name: "party", consistency: "strong" }));
  const items = POTLUCK.map((p) => ({ ...p, left: Math.max(0, p.total - counts[p.id]) }));
  return Response.json({ items }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/slots" };
