import { Prisma } from "@/generated/prisma/client";

export async function findMissingPropertyMemberIds(
  transaction: Prisma.TransactionClient,
  propertyId: string,
  userIds: Array<string | null | undefined>,
) {
  const uniqueUserIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];

  if (uniqueUserIds.length === 0) return [];

  const members = await transaction.propertyMember.findMany({
    where: {
      propertyId,
      userId: { in: uniqueUserIds },
    },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((member) => member.userId));

  return uniqueUserIds.filter((userId) => !memberIds.has(userId));
}
