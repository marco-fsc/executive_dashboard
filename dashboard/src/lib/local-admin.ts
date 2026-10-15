import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify<string, string, number, Buffer>(scrypt);

export async function hashAdminPassword(password: string): Promise<string> {
  if (password.length < 16 || password.length > 256) {
    throw new Error("The admin password must contain 16 to 256 characters.");
  }
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyAdminCredentials(
  username: unknown,
  password: unknown,
  passwordHash: string | undefined,
): Promise<boolean> {
  if (!passwordHash) return false;
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(passwordHash);
  if (!match) throw new Error("LOCAL_ADMIN_PASSWORD_HASH is not a valid scrypt password hash.");
  if (username !== "admin" || typeof password !== "string" ||
      password.length < 16 || password.length > 256) return false;

  const key = await deriveKey(password, match[1], 64);
  return timingSafeEqual(key, Buffer.from(match[2], "hex"));
}
