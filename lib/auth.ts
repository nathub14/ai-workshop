export function codeOk(code: unknown) {
  const expected = process.env.ACCESS_CODE;
  if (!expected) return true; // no code set (local testing)
  return typeof code === "string" && code.trim().toLowerCase() === expected.trim().toLowerCase();
}

export function adminOk(pw: unknown) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return true;
  return typeof pw === "string" && pw === expected;
}
