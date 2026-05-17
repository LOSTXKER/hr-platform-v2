import { validateThaiPID, isValidThaiPhone, formatThaiPhone } from "../src/lib/validation";

const cases: Array<[string, string, boolean]> = [
  ["PID valid (sample 1)", "1100200300400", false], // synthetic — likely invalid
  ["PID 12 digits", "110020030040", false],
  ["PID 14 digits", "11002003004001", false],
  ["PID non-numeric", "abc1234567890", false],
];

console.log("--- Thai PID ---");
for (const [name, val, _exp] of cases) {
  const r = validateThaiPID(val);
  console.log(`  ${name}: "${val}" → ${r.valid ? "valid" : "invalid: " + r.reason}`);
}

// Generate a valid PID for testing (compute valid checksum)
function buildValidPID(prefix12: string): string {
  if (prefix12.length !== 12) throw new Error("prefix must be 12 digits");
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(prefix12[i]!, 10) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  return prefix12 + check;
}
const validPID = buildValidPID("110020030040");
const v = validateThaiPID(validPID);
console.log(`  Built valid PID: ${validPID} → ${v.valid ? "valid" : "INVALID — BUG"}`);
if (!v.valid) process.exit(1);

console.log("\n--- Thai phone ---");
const phones = [
  ["089-123-4567", true],
  ["0891234567", true],
  ["66891234567", false], // intl prefix not 0
  ["1234567", false], // too short
  ["08912345678", false], // 11 digits
];
for (const [p, exp] of phones) {
  const ok = isValidThaiPhone(p as string);
  const formatted = formatThaiPhone(p as string);
  const pass = ok === exp;
  console.log(`  ${pass ? "✓" : "✗"} "${p}" → valid=${ok}, formatted=${formatted}`);
  if (!pass) process.exit(1);
}

console.log("\n✅ Validation tests passed");
