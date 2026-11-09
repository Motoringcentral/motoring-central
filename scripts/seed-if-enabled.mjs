// Loads the sample partners during a deploy when SEED_SAMPLE_DATA=true.
// Used on the preview site only; leave it unset in production.
import { execSync } from "node:child_process";

if (process.env.SEED_SAMPLE_DATA === "true") {
  execSync("npx prisma db seed", { stdio: "inherit" });
} else {
  console.log("Skipping sample data (SEED_SAMPLE_DATA is not true).");
}
