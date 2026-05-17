// Employee data access — wraps Prisma with encryption for PII fields
// Pattern: encrypt on write (create/update), decrypt on read (find).
// Bypass RLS via service-role Prisma client; isolation enforced at app layer via organizationId filter.

import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";
import { validateThaiPID, formatThaiPhone } from "./validation";
import type {
  EmployeeUncheckedCreateInput,
  EmployeeUncheckedUpdateInput,
} from "@/generated/prisma/models";

// ============================================================
// Input shapes (plaintext — bankAccountNumber/taxPin are encrypted before DB write)
// ============================================================

export type EmployeeCreateInput = Omit<
  EmployeeUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "organizationId" | "bankAccountNumberEnc" | "taxPinEnc"
> & {
  bankAccountNumber?: string | null;
  taxPin?: string | null;
};

export type EmployeeUpdateInput = Omit<
  EmployeeUncheckedUpdateInput,
  "id" | "createdAt" | "updatedAt" | "organizationId" | "bankAccountNumberEnc" | "taxPinEnc"
> & {
  bankAccountNumber?: string | null;
  taxPin?: string | null;
};

export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

// ============================================================
// Validate + normalize input
// ============================================================

function validate(input: EmployeeCreateInput | EmployeeUpdateInput): void {
  if (input.nationalId) {
    const v = validateThaiPID(String(input.nationalId));
    if (!v.valid) throw new ValidationError("nationalId", v.reason ?? "invalid PID");
  }
  if (input.phonePrimary) {
    const f = formatThaiPhone(String(input.phonePrimary));
    if (!f) throw new ValidationError("phonePrimary", "invalid Thai phone");
    input.phonePrimary = f;
  }
  if (input.phoneSecondary) {
    const f = formatThaiPhone(String(input.phoneSecondary));
    if (!f) throw new ValidationError("phoneSecondary", "invalid Thai phone");
    input.phoneSecondary = f;
  }
}

function encryptInput<T extends { bankAccountNumber?: string | null; taxPin?: string | null }>(
  input: T
): Omit<T, "bankAccountNumber" | "taxPin"> & { bankAccountNumberEnc?: string | null; taxPinEnc?: string | null } {
  const { bankAccountNumber, taxPin, ...rest } = input;
  const out: Record<string, unknown> = { ...rest };
  if (bankAccountNumber !== undefined) {
    out.bankAccountNumberEnc = bankAccountNumber === null ? null : encrypt(bankAccountNumber);
  }
  if (taxPin !== undefined) {
    out.taxPinEnc = taxPin === null ? null : encrypt(taxPin);
  }
  return out as Omit<T, "bankAccountNumber" | "taxPin"> & {
    bankAccountNumberEnc?: string | null;
    taxPinEnc?: string | null;
  };
}

function decryptRow<T extends { bankAccountNumberEnc?: string | null; taxPinEnc?: string | null }>(
  row: T
): Omit<T, "bankAccountNumberEnc" | "taxPinEnc"> & {
  bankAccountNumber: string | null;
  taxPin: string | null;
} {
  const { bankAccountNumberEnc, taxPinEnc, ...rest } = row;
  return {
    ...(rest as Omit<T, "bankAccountNumberEnc" | "taxPinEnc">),
    bankAccountNumber: bankAccountNumberEnc ? decrypt(bankAccountNumberEnc) : null,
    taxPin: taxPinEnc ? decrypt(taxPinEnc) : null,
  };
}

// ============================================================
// CRUD operations
// ============================================================

export async function listEmployees(orgId: string) {
  const rows = await prisma.employee.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(decryptRow);
}

export async function getEmployee(orgId: string, id: string) {
  const row = await prisma.employee.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!row) return null;
  return decryptRow(row);
}

export async function createEmployee(orgId: string, input: EmployeeCreateInput) {
  validate(input);
  const encrypted = encryptInput(input);
  const row = await prisma.employee.create({
    data: {
      ...(encrypted as EmployeeUncheckedCreateInput),
      organizationId: orgId,
    },
  });
  return decryptRow(row);
}

export async function updateEmployee(orgId: string, id: string, input: EmployeeUpdateInput) {
  validate(input);
  const encrypted = encryptInput(input);
  const result = await prisma.employee.updateMany({
    where: { id, organizationId: orgId },
    data: encrypted as EmployeeUncheckedUpdateInput,
  });
  if (result.count === 0) return null;
  return getEmployee(orgId, id);
}

export async function deleteEmployee(orgId: string, id: string): Promise<boolean> {
  const result = await prisma.employee.deleteMany({
    where: { id, organizationId: orgId },
  });
  return result.count > 0;
}
