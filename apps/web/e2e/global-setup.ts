import { execSync } from "node:child_process";
import { join } from "node:path";

export default function globalSetup() {
  execSync("bash scripts/db-reseed.sh", {
    cwd: join(import.meta.dirname, "../../.."),
    stdio: "inherit",
  });
}
