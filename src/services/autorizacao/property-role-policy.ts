import { PropertyRole } from "@/generated/prisma/enums";

export const CAPABILITIES = [
  "READ_PROPERTY",
  "CREATE_AREA",
  "EDIT_AREA",
  "CREATE_PRODUCT",
  "EDIT_PRODUCT",
  "CREATE_RECORD",
  "MOVE_STOCK",
  "MANAGE_TEAM",
  "ADJUST_STOCK",
  "REVERSE_STOCK",
  "VIEW_AUDIT",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_LABELS = {
  [PropertyRole.OWNER]: "Proprietário",
  [PropertyRole.MANAGER]: "Gerente",
  [PropertyRole.EMPLOYEE]: "Funcionário",
  [PropertyRole.VIEWER]: "Visualizador",
} as const satisfies Record<PropertyRole, string>;

const ALL_CAPABILITIES = Object.freeze([...CAPABILITIES]);
const OPERATIONAL_CAPABILITIES = Object.freeze<Capability[]>([
  "READ_PROPERTY",
  "CREATE_RECORD",
  "MOVE_STOCK",
]);
const READ_ONLY_CAPABILITIES = Object.freeze<Capability[]>(["READ_PROPERTY"]);

export const CAPABILITIES_BY_ROLE = {
  [PropertyRole.OWNER]: ALL_CAPABILITIES,
  [PropertyRole.MANAGER]: ALL_CAPABILITIES,
  [PropertyRole.EMPLOYEE]: OPERATIONAL_CAPABILITIES,
  [PropertyRole.VIEWER]: READ_ONLY_CAPABILITIES,
} as const satisfies Record<PropertyRole, readonly Capability[]>;

const MANAGER_TARGET_ROLES = new Set<PropertyRole>([
  PropertyRole.EMPLOYEE,
  PropertyRole.VIEWER,
]);
const PROPERTY_ROLES = new Set<string>(Object.values(PropertyRole));

export type TeamPolicyDenialReason =
  | "INVALID_ROLE"
  | "ROLE_UNCHANGED"
  | "SELF_MANAGEMENT"
  | "FORBIDDEN";

export type TeamPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: TeamPolicyDenialReason };

const ALLOWED = Object.freeze({ allowed: true } as const);

function denied(reason: TeamPolicyDenialReason): TeamPolicyDecision {
  return { allowed: false, reason };
}

export function isPropertyRole(value: unknown): value is PropertyRole {
  return typeof value === "string" && PROPERTY_ROLES.has(value);
}

export function getRoleLabel(role: PropertyRole) {
  return ROLE_LABELS[role];
}

export const getPropertyRoleLabel = getRoleLabel;

export function getCapabilities(role: PropertyRole): readonly Capability[] {
  return CAPABILITIES_BY_ROLE[role];
}

export const getCapabilitiesForRole = getCapabilities;

export function hasCapability(role: PropertyRole, capability: Capability) {
  return CAPABILITIES_BY_ROLE[role].includes(capability);
}

export function authorizeMemberAddition(
  actorRole: PropertyRole,
  assignedRole: unknown,
): TeamPolicyDecision {
  if (!isPropertyRole(assignedRole)) return denied("INVALID_ROLE");
  if (actorRole === PropertyRole.OWNER) return ALLOWED;
  if (
    actorRole === PropertyRole.MANAGER &&
    MANAGER_TARGET_ROLES.has(assignedRole)
  ) {
    return ALLOWED;
  }
  return denied("FORBIDDEN");
}

export function authorizeMemberRoleChange(input: {
  actorUserId: string;
  actorRole: PropertyRole;
  targetUserId: string;
  targetRole: PropertyRole;
  newRole: unknown;
}): TeamPolicyDecision {
  if (input.actorUserId === input.targetUserId) {
    return denied("SELF_MANAGEMENT");
  }
  if (!isPropertyRole(input.newRole)) return denied("INVALID_ROLE");
  if (input.targetRole === input.newRole) return denied("ROLE_UNCHANGED");
  if (input.actorRole === PropertyRole.OWNER) return ALLOWED;
  if (
    input.actorRole === PropertyRole.MANAGER &&
    MANAGER_TARGET_ROLES.has(input.targetRole) &&
    MANAGER_TARGET_ROLES.has(input.newRole)
  ) {
    return ALLOWED;
  }
  return denied("FORBIDDEN");
}

export function authorizeMemberRemoval(input: {
  actorUserId: string;
  actorRole: PropertyRole;
  targetUserId: string;
  targetRole: PropertyRole;
}): TeamPolicyDecision {
  if (input.actorUserId === input.targetUserId) {
    return denied("SELF_MANAGEMENT");
  }
  if (input.actorRole === PropertyRole.OWNER) return ALLOWED;
  if (
    input.actorRole === PropertyRole.MANAGER &&
    MANAGER_TARGET_ROLES.has(input.targetRole)
  ) {
    return ALLOWED;
  }
  return denied("FORBIDDEN");
}
