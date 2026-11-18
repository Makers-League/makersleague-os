import { createHash, timingSafeEqual } from "node:crypto";

import { syncClubFromEnv } from "@ml/easyverein";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Background function (the -background suffix gives it up to 15 minutes).
 * Started by sync-trigger; protected by SYNC_SECRET. Runs with the secret key,
 * which only Netlify functions get.
 */
export default async (req: Request) => {
  const secret = process.env.SYNC_SECRET;
  const given = req.headers.get("x-sync-secret") ?? "";
  if (!secret || !timingSafeEqual(digest(given), digest(secret))) {
    return new Response("Forbidden", { status: 403 });
  }

  const result = await syncClubFromEnv(process.env);
  console.log("sync finished", result.status, JSON.stringify(result.stats));
  return new Response(null, { status: 202 });
};
