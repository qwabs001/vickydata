import test from "node:test";
import assert from "node:assert/strict";
import { isDatabaseConnectionError } from "../../src/backend/lib/utils/dbError";
import { loginSchema, resetPasswordSchema, signupSchema } from "../../src/shared/schemas/auth.schema";
import {
  isPhoneLoginIdentity,
  normalizePhoneNumber,
  normalizeUsername
} from "../../src/backend/services/auth/authIdentity";

test("login schema trims username input", () => {
  const parsed = loginSchema.parse({
    username: "  Bomzydget2@gmail.com  ",
    password: "Orange$1234"
  });

  assert.equal(parsed.username, "Bomzydget2@gmail.com");
});

test("signup and reset schemas trim identity fields", () => {
  const signup = signupSchema.parse({
    username: "  NewUser@example.com  ",
    phoneNumber: " 0241234567 ",
    password: "secret12",
    confirmPassword: "secret12",
    referralCode: "  REF123 "
  });
  const reset = resetPasswordSchema.parse({
    username: "  NewUser@example.com  ",
    phoneNumber: " 0241234567 ",
    password: "secret12",
    confirmPassword: "secret12"
  });

  assert.equal(signup.username, "NewUser@example.com");
  assert.equal(signup.phoneNumber, "0241234567");
  assert.equal(signup.referralCode, "REF123");
  assert.equal(reset.username, "NewUser@example.com");
  assert.equal(reset.phoneNumber, "0241234567");
});

test("auth identity helpers normalize credentials and detect phone login values", () => {
  assert.equal(normalizeUsername("  Admin@Example.com "), "Admin@Example.com");
  assert.equal(normalizePhoneNumber(" 0241234567 "), "0241234567");
  assert.equal(isPhoneLoginIdentity("0241234567"), true);
  assert.equal(isPhoneLoginIdentity("+233 24 123 4567"), true);
  assert.equal(isPhoneLoginIdentity("Bomzydget2@gmail.com"), false);
});

test("database connection helper recognizes DNS and tenant failures", () => {
  assert.equal(
    isDatabaseConnectionError(new Error("FATAL: (ENOTFOUND) tenant/user postgres.project not found")),
    true
  );
  assert.equal(
    isDatabaseConnectionError(new Error("could not translate host name \"db.example\" to address")),
    true
  );
  assert.equal(isDatabaseConnectionError(new Error("Invalid credentials")), false);
});
