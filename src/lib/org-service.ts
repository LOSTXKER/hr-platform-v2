// Generic CRUD helpers for org-structure tables (positions, departments, branches)
// No encryption — these are public org metadata, not PII.

import { prisma } from "./prisma";

export type OrgTable = "position" | "department" | "branch";

export async function listOrgRecords(table: OrgTable, orgId: string) {
  switch (table) {
    case "position":
      return prisma.position.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
    case "department":
      return prisma.department.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
    case "branch":
      return prisma.branch.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
  }
}

export async function getOrgRecord(table: OrgTable, orgId: string, id: string) {
  switch (table) {
    case "position":
      return prisma.position.findFirst({ where: { id, organizationId: orgId } });
    case "department":
      return prisma.department.findFirst({ where: { id, organizationId: orgId } });
    case "branch":
      return prisma.branch.findFirst({ where: { id, organizationId: orgId } });
  }
}

export async function createOrgRecord(
  table: OrgTable,
  orgId: string,
  data: Record<string, unknown>
) {
  const payload = { ...data, organizationId: orgId };
  switch (table) {
    case "position":
      return prisma.position.create({ data: payload as never });
    case "department":
      return prisma.department.create({ data: payload as never });
    case "branch":
      return prisma.branch.create({ data: payload as never });
  }
}

export async function updateOrgRecord(
  table: OrgTable,
  orgId: string,
  id: string,
  data: Record<string, unknown>
) {
  let count = 0;
  switch (table) {
    case "position":
      count = (await prisma.position.updateMany({ where: { id, organizationId: orgId }, data: data as never })).count;
      break;
    case "department":
      count = (await prisma.department.updateMany({ where: { id, organizationId: orgId }, data: data as never })).count;
      break;
    case "branch":
      count = (await prisma.branch.updateMany({ where: { id, organizationId: orgId }, data: data as never })).count;
      break;
  }
  if (count === 0) return null;
  return getOrgRecord(table, orgId, id);
}

export async function deleteOrgRecord(table: OrgTable, orgId: string, id: string): Promise<boolean> {
  let count = 0;
  switch (table) {
    case "position":
      count = (await prisma.position.deleteMany({ where: { id, organizationId: orgId } })).count;
      break;
    case "department":
      count = (await prisma.department.deleteMany({ where: { id, organizationId: orgId } })).count;
      break;
    case "branch":
      count = (await prisma.branch.deleteMany({ where: { id, organizationId: orgId } })).count;
      break;
  }
  return count > 0;
}
