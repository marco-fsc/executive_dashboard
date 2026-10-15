import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { hashAdminPassword } from "../src/lib/local-admin";

async function main() {
  loadEnvConfig(process.cwd());
  const password = randomBytes(24).toString("base64url");
  const hash = await hashAdminPassword(password);
  let env: string;
  try {
    env = await readFile(".env.local", "utf8");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    env = "";
  }
  env = env.replace(/^\s*LOCAL_ADMIN_PASSWORD_HASH\s*=.*(?:\r?\n|$)/gm, "");
  env = `${env.trimEnd()}\nLOCAL_ADMIN_PASSWORD_HASH=${hash}\n`;
  if (!process.env.AUTH_SECRET) {
    env += `AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`;
  }
  await writeFile(".env.local", env, { mode: 0o600 });
  console.log("Local admin configured in .env.local. Restart the dashboard.");
  console.log("Username: admin");
  console.log(`Password (save privately; it is not stored): ${password}`);
  console.log("\nFor Vercel, set this environment variable and redeploy:");
  console.log(`LOCAL_ADMIN_PASSWORD_HASH=${hash}`);
  console.log("Also ensure AUTH_SECRET is configured in Vercel. Never commit these values.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
