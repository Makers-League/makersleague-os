import { syncClubFromEnv } from "./env";

const result = await syncClubFromEnv();
console.log(JSON.stringify(result, null, 2));
if (result.status !== "succeeded") {
  process.exitCode = 1;
}
