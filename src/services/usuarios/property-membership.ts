import "server-only";

import { Prisma } from "@/generated/prisma/client";

export async function findUserIdsWithoutActivePropertyMembership(
  transaction: Prisma.TransactionClient,
  propertyId: string,
  userIds: Array<string | null | undefined>,
) {
  const uniqueUserIds = [
    ...new Set(
      userIds.filter(
        (id): id is string => id !== null && id !== undefined,
      ),
    ),
  ];

  if (uniqueUserIds.length === 0) return [];

  const members = await transaction.propertyMember.findMany({
    where: {
      propertyId,
      userId: { in: uniqueUserIds },
      user: { deactivatedAt: null },
    },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((member) => member.userId));

  return uniqueUserIds.filter((userId) => !memberIds.has(userId));
}
