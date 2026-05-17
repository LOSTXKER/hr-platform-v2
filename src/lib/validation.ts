// Thai-specific validation helpers — pure functions, no deps
// PID = บัตรประชาชน 13 หลัก (mod 11 check digit)
// Phone = เบอร์ไทย 9-10 หลัก (รับ 0X-XXXX-XXXX หรือ 0XXXXXXXXX)

export function validateThaiPID(pid: string): { valid: boolean; reason?: string } {
  const digits = pid.replace(/\D/g, "");
  if (digits.length !== 13) return { valid: false, reason: "must be 13 digits" };

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]!, 10) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  if (checkDigit !== parseInt(digits[12]!, 10)) {
    return { valid: false, reason: "checksum mismatch" };
  }
  return { valid: true };
}

export function formatThaiPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 10) return null;
  if (!digits.startsWith("0")) return null;
  return digits;
}

export function isValidThaiPhone(input: string): boolean {
  return formatThaiPhone(input) !== null;
}
