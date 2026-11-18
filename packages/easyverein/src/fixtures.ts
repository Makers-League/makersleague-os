import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { easyVereinMemberSchema, mapEasyVereinMembers, todayIso } from "./schema";
import type { MemberSource } from "./types";

export const defaultFixturesPath = fileURLToPath(
  new URL("../fixtures/members.json", import.meta.url),
);

/** Reads fake members in the easyVerein API shape from a JSON file. */
export const fixturesSource = (
  path: string = defaultFixturesPath,
  now: () => Date = () => new Date(),
): MemberSource => ({
  name: "fixtures",
  listMembers: async () => {
    const json: unknown = JSON.parse(await readFile(path, "utf8"));
    const raws = z.array(easyVereinMemberSchema).parse(json);
    return mapEasyVereinMembers(raws, todayIso(now()));
  },
});
