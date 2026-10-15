import assert from "node:assert/strict";
import { test } from "node:test";
import { hashAdminPassword, verifyAdminCredentials } from "./local-admin";
import { getAdminEmail, isAdminEmail, resolveRole } from "./acl";

test("local admin verifies a strong password without accepting other credentials", async () => {
  const password = "a-test-password-with-32-characters";
  const hash = await hashAdminPassword(password);
  assert.match(hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(await verifyAdminCredentials("admin", password, hash), true);
  assert.equal(await verifyAdminCredentials("admin", "another-long-but-wrong-password", hash), false);
  assert.equal(await verifyAdminCredentials("other", password, hash), false);
  assert.equal(await verifyAdminCredentials("admin", "password", hash), false);
  assert.equal(await verifyAdminCredentials("admin", null, hash), false);
  assert.equal(await verifyAdminCredentials("admin", "a".repeat(257), hash), false);
  assert.equal(await verifyAdminCredentials("admin", password, undefined), false);
});

test("password hashes use independent salts and reject weak passwords or invalid configuration", async () => {
  const password = "a-test-password-with-32-characters";
  assert.notEqual(await hashAdminPassword(password), await hashAdminPassword(password));
  await assert.rejects(hashAdminPassword("password"), /16 to 256/);
  await assert.rejects(verifyAdminCredentials("admin", password, "invalid"), /not a valid/);
});

test("fallback identity receives existing administrator permissions without an ACL entry", () => {
  const email = getAdminEmail();
  assert.equal(isAdminEmail(email), true);
  assert.deepEqual(resolveRole(email, { users: {} }), { role: "admin" });
  assert.equal(resolveRole("not-authorized@example.org", { users: {} }), null);
});
