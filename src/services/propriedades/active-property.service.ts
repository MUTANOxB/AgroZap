import "server-only";

import type { PropertyRole } from "@/generated/prisma/enums";
import { db } from "@/lib/prisma";
import {
  getCapabilities,
  type Capability,
} from "@/services/autorizacao/property-role-policy";

export type ActivePropertyContext = {
  user: {
    id: string;
    name: string;
  };
  property: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    id: string;
    role: PropertyRole;
  };
  role: PropertyRole;
  capabilities: readonly Capability[];
};

export type ActivePropertyOption = {
  membershipId: string;
  property: {
    id: string;
    name: string;
    slug: string;
  };
  role: PropertyRole;
};

/**
 * Resolve a regra de autorização sem depender da API de cookies. O propertyId
 * é apenas um candidato: só vira contexto depois da revalidação no banco.
 */
export async function resolveActivePropertyContext(
  userId: string,
  propertyId: string,
): Promise<ActivePropertyContext | null> {
  const membership = await db.propertyMember.findFirst({
    where: {
      propertyId,
      userId,
      user: { deactivatedAt: null },
      property: { archivedAt: null },
    },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!membership) return null;

  return {
    user: membership.user,
    property: membership.property,
    membership: {
      id: membership.id,
      role: membership.role,
    },
    role: membership.role,
    capabilities: [...getCapabilities(membership.role)],
  };
}

export async function listActivePropertiesForUser(
  userId: string,
): Promise<ActivePropertyOption[]> {
  const memberships = await db.propertyMember.findMany({
    where: {
      userId,
      user: { deactivatedAt: null },
      property: { archivedAt: null },
    },
    select: {
      id: true,
      role: true,
      property: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [{ property: { name: "asc" } }, { id: "asc" }],
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    property: membership.property,
    role: membership.role,
  }));
}
