import "server-only";

import {
  Prisma,
  type PropertyRole,
} from "@/generated/prisma/client";
import {
  PropertyCapabilityError,
  requirePropertyCapability,
} from "@/services/autorizacao/property-capability-guard";
import type { Capability } from "@/services/autorizacao/property-role-policy";

const RURAL_WEB_AUTHORIZATION_MARK = Symbol("rural-web-authorization");

export type RuralWebAuthorization = Readonly<{
  [RURAL_WEB_AUTHORIZATION_MARK]: true;
}>;

/**
 * Argumento server-only usado pelas Actions; não faz parte de nenhum input
 * público e sua identidade não pode ser recriada pelo navegador.
 */
export const RURAL_WEB_AUTHORIZATION: RuralWebAuthorization = Object.freeze({
  [RURAL_WEB_AUTHORIZATION_MARK]: true,
});

/**
 * Relê e bloqueia a membership dentro da transação que fará a escrita. Assim,
 * uma remoção ou troca de papel concorrente não confirma a mutação com uma
 * capability obsoleta lida antes da transação.
 */
export async function requireTransactionalRuralWebCapability(
  transaction: Prisma.TransactionClient,
  authorization: RuralWebAuthorization | undefined,
  input: {
    propertyId: string;
    actorUserId: string;
    capability: Capability;
  },
): Promise<void> {
  if (authorization !== RURAL_WEB_AUTHORIZATION) {
    throw new PropertyCapabilityError([input.capability]);
  }

  const memberships = await transaction.$queryRaw<Array<{ role: PropertyRole }>>`
    SELECT pm."role"::text AS "role"
      FROM "PropertyMember" AS pm
      JOIN "User" AS u ON u."id" = pm."userId"
     WHERE pm."propertyId" = ${input.propertyId}
       AND pm."userId" = ${input.actorUserId}
       AND u."deactivatedAt" IS NULL
     FOR UPDATE OF pm, u
  `;
  const membership = memberships[0];
  if (!membership) throw new PropertyCapabilityError([input.capability]);

  requirePropertyCapability(membership.role, input.capability);
}
