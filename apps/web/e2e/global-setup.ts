import { execSync } from "node:child_process";
import { join } from "node:path";

export default function globalSetup() {
  execSync("pnpm exec supabase db reset", {
    cwd: join(import.meta.dirname, "../../.."),
    stdio: "inherit",
  });
}
