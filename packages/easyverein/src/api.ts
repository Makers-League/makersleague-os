import { z } from "zod";

import {
  easyVereinMemberQuery,
  easyVereinMemberSchema,
  mapEasyVereinMembers,
  todayIso,
} from "./schema";
import type { MemberSource } from "./types";

export const EASYVEREIN_API_URL = "https://hexa.easyverein.com/api/v2.0";

const pageSchema = z.object({
  next: z.string().nullable(),
  results: z.array(easyVereinMemberSchema),
});

type ApiSourceOptions = {
  /** easyVerein API token. Later read per club from Supabase Vault. */
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
};

/**
 * easyVerein v2.0 member list with pagination. Read-only: the OS never writes
 * to easyVerein and never calls the refresh-token endpoint (the website's
 * cron owns the current token).
 */
export const apiSource = ({
  token,
  baseUrl = EASYVEREIN_API_URL,
  fetch: fetchFn = fetch,
  now = () => new Date(),
}: ApiSourceOptions): MemberSource => ({
  name: "api",
  listMembers: async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const params = new URLSearchParams({ query: easyVereinMemberQuery, limit: "100" });
    let url: string | null = `${baseUrl}/member?${params.toString()}`;
    const raws: Array<z.infer<typeof easyVereinMemberSchema>> = [];

    while (url) {
      // Pages come one after another: each response holds the next URL.
      const res = await fetchFn(url, { headers });
      if (!res.ok) {
        throw new Error(`easyVerein ${res.status} ${res.statusText} for ${new URL(url).pathname}`);
      }
      const page = pageSchema.parse(await res.json());
      raws.push(...page.results);
      url = page.next;
    }

    return mapEasyVereinMembers(raws, todayIso(now()));
  },
});
