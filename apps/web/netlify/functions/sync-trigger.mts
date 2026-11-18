import type { Config } from "@netlify/functions";

/**
 * Scheduled functions stop after 30 seconds, so this one only starts the
 * background function. Scheduled functions run on the published deploy only;
 * use "Run now" in the Netlify UI or `pnpm sync` locally to test.
 */
export default async () => {
  const base = process.env.URL;
  const secret = process.env.SYNC_SECRET;
  if (!base || !secret) throw new Error("URL or SYNC_SECRET is not set");

  const res = await fetch(`${base}/.netlify/functions/sync-members-background`, {
    method: "POST",
    headers: { "x-sync-secret": secret },
  });
  if (res.status !== 202) throw new Error(`Starting the sync failed: ${res.status}`);
};

export const config: Config = {
  schedule: "@hourly",
};
