import "server-only";

import type { PropertyRole } from "@/generated/prisma/enums";
import {
  hasCapability,
  type Capability,
} from "./property-role-policy";

export type PropertyCapabilityErrorCode = "FORBIDDEN";

/**
 * Erro seguro para fronteiras WEB. A mensagem não revela o papel atual nem
 * quais outras capacidades a pessoa possui.
 */
export class PropertyCapabilityError extends Error {
  readonly code: PropertyCapabilityErrorCode = "FORBIDDEN";

  constructor(
    public readonly requiredCapabilities: readonly Capability[],
    message = "Você não tem permissão para realizar esta operação.",
  ) {
    super(message);
    this.name = "PropertyCapabilityError";
  }
}

function roleHasCapability(role: PropertyRole, capability: Capability) {
  try {
    return hasCapability(role, capability);
  } catch {
    return false;
  }
}

export function requirePropertyCapability(
  role: PropertyRole,
  capability: Capability,
): void {
  requirePropertyCapabilities(role, [capability]);
}

export function requirePropertyCapabilities(
  role: PropertyRole,
  capabilities: readonly Capability[],
): void {
  const requiredCapabilities = [...new Set(capabilities)];
  if (
    requiredCapabilities.every((capability) =>
      roleHasCapability(role, capability),
    )
  ) {
    return;
  }

  throw new PropertyCapabilityError(requiredCapabilities);
}
