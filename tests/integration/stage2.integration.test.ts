import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { assertSafeIntegrationRuntime } from "./test-database";

assertSafeIntegrationRuntime(process.env);

const [
  prismaModule,
  prismaLib,
  credentialsService,
  passwordService,
  activePropertyService,
  teamService,
  teamErrors,
] = await Promise.all([
  import("@/generated/prisma/client"),
  import("@/lib/prisma"),
  import("@/services/auth/credentials.service"),
  import("@/services/auth/password"),
  import("@/services/propriedades/active-property.service"),
  import("@/services/equipe/team.service"),
  import("@/services/equipe/errors"),
]);

const {
  FarmRecordType,
  Prisma,
  PropertyRole,
  RecordSource,
  StockMovementType,
} = prismaModule;
const { db } = prismaLib;
const { authenticateCredentials } = credentialsService;
const { hashPassword } = passwordService;
const {
  listActivePropertiesForUser,
  resolveActivePropertyContext,
} = activePropertyService;
const {
  addExistingMember,
  changeMemberRole,
  listPropertyTeam,
  removeMember,
} = teamService;
const { TeamDomainError } = teamErrors;

after(async () => {
  await db.$disconnect();
});

function token() {
  return randomUUID().replaceAll("-", "");
}

function uniquePhone() {
  const digits = [...createHash("sha256").update(token()).digest("hex")]
    .map((character) => Number.parseInt(character, 16) % 10)
    .join("")
    .slice(0, 8);
  return `+55119${digits}`;
}

function humanPhone(canonicalPhone: string) {
  const national = canonicalPhone.slice(3);
  return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
}

function temporaryPassword() {
  return randomBytes(18).toString("base64url");
}

async function createProperty(name = "Propriedade Etapa 2") {
  const unique = token();
  return db.property.create({
    data: {
      name: `${name} ${unique.slice(0, 8)}`,
      slug: `stage2-${unique}`,
    },
  });
}

async function createUser(options: {
  name?: string;
  passwordHash?: string | null;
  deactivatedAt?: Date | null;
} = {}) {
  return db.user.create({
    data: {
      name: options.name ?? `Usuário ${token().slice(0, 8)}`,
      phone: uniquePhone(),
      passwordHash: options.passwordHash,
      deactivatedAt: options.deactivatedAt,
    },
  });
}

async function createTeam(roles: Array<(typeof PropertyRole)[keyof typeof PropertyRole]>) {
  const property = await createProperty();
  const users = await Promise.all(
    roles.map((role, index) => createUser({ name: `${role} ${index + 1}` })),
  );
  await db.propertyMember.createMany({
    data: roles.map((role, index) => ({
      propertyId: property.id,
      userId: users[index].id,
      role,
    })),
  });
  return { property, users };
}

async function expectTeamError(
  operation: Promise<unknown>,
  acceptedCodes: string | string[],
) {
  const codes = Array.isArray(acceptedCodes) ? acceptedCodes : [acceptedCodes];
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof TeamDomainError);
    assert.ok(
      codes.includes(error.code),
      `Código recebido: ${error.code}; esperados: ${codes.join(", ")}`,
    );
    return true;
  });
}

test("CASO 1 — autenticação válida retorna somente a identidade esperada", async () => {
  const password = temporaryPassword();
  const user = await createUser({
    name: "Identidade válida",
    passwordHash: await hashPassword(password),
  });

  const identity = await authenticateCredentials({
    phone: humanPhone(user.phone),
    password,
  });

  assert.deepEqual(identity, { id: user.id, name: user.name });
  assert.equal(identity && Object.hasOwn(identity, "passwordHash"), false);
});

test("CASO 2 — senha errada é recusada sem revelar a conta", async () => {
  const password = temporaryPassword();
  const user = await createUser({ passwordHash: await hashPassword(password) });

  assert.equal(
    await authenticateCredentials({
      phone: user.phone,
      password: temporaryPassword(),
    }),
    null,
  );
});

test("CASO 3 — User desativado é recusado mesmo com hash correto", async () => {
  const password = temporaryPassword();
  const user = await createUser({
    passwordHash: await hashPassword(password),
    deactivatedAt: new Date(),
  });

  assert.equal(
    await authenticateCredentials({ phone: user.phone, password }),
    null,
  );
});

test("CASO 4 — membership válida resolve a propriedade ativa", async () => {
  const team = await createTeam([PropertyRole.OWNER]);
  const user = team.users[0];

  const context = await resolveActivePropertyContext(user.id, team.property.id);
  assert.ok(context);
  assert.equal(context.user.id, user.id);
  assert.equal(context.property.id, team.property.id);
  assert.equal(context.role, PropertyRole.OWNER);
  assert.ok(context.capabilities.includes("MANAGE_TEAM"));
  assert.deepEqual(
    (await listActivePropertiesForUser(user.id)).map((item) => item.property.id),
    [team.property.id],
  );

  await db.propertyMember.delete({
    where: {
      propertyId_userId: {
        propertyId: team.property.id,
        userId: user.id,
      },
    },
  });
  assert.equal(
    await resolveActivePropertyContext(user.id, team.property.id),
    null,
  );
});

test("CASO 5 — membership de A não autoriza resolver a propriedade B", async () => {
  const [teamA, teamB] = await Promise.all([
    createTeam([PropertyRole.OWNER]),
    createTeam([PropertyRole.OWNER]),
  ]);

  assert.equal(
    await resolveActivePropertyContext(teamA.users[0].id, teamB.property.id),
    null,
  );
});

test("CASO 6 — Property arquivada não pode virar ativa", async () => {
  const team = await createTeam([PropertyRole.OWNER]);
  await db.property.update({
    where: { id: team.property.id },
    data: { archivedAt: new Date() },
  });

  assert.equal(
    await resolveActivePropertyContext(team.users[0].id, team.property.id),
    null,
  );
  assert.deepEqual(await listActivePropertiesForUser(team.users[0].id), []);
});

test("CASO 7 — OWNER adiciona membro existente e gera AuditLog", async () => {
  const team = await createTeam([PropertyRole.OWNER]);
  const target = await createUser({ name: "Novo gerente" });

  const membership = await addExistingMember({
    propertyId: team.property.id,
    actorUserId: team.users[0].id,
    phone: humanPhone(target.phone),
    role: PropertyRole.MANAGER,
  });

  assert.equal(membership.userId, target.id);
  assert.equal(membership.role, PropertyRole.MANAGER);
  const audit = await db.auditLog.findFirstOrThrow({
    where: {
      propertyId: team.property.id,
      action: "PROPERTY_MEMBER_ADDED",
      entityId: membership.id,
    },
  });
  assert.equal(audit.actorUserId, team.users[0].id);
  assert.deepEqual(audit.afterData, { role: PropertyRole.MANAGER });
  assert.deepEqual(audit.metadata, { targetUserId: target.id });

  const visibleTeam = await listPropertyTeam({
    propertyId: team.property.id,
    actorUserId: team.users[0].id,
  });
  assert.ok(visibleTeam.every((member) => Object.hasOwn(member, "phone")));
});

test("CASO 8 — MANAGER adiciona EMPLOYEE e telefone não vaza ao EMPLOYEE", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.MANAGER]);
  const target = await createUser({ name: "Funcionário adicionado" });

  await addExistingMember({
    propertyId: team.property.id,
    actorUserId: team.users[1].id,
    phone: target.phone,
    role: PropertyRole.EMPLOYEE,
  });

  const asManager = await listPropertyTeam({
    propertyId: team.property.id,
    actorUserId: team.users[1].id,
  });
  assert.ok(asManager.every((member) => Object.hasOwn(member, "phone")));

  const asEmployee = await listPropertyTeam({
    propertyId: team.property.id,
    actorUserId: target.id,
  });
  assert.ok(asEmployee.every((member) => !Object.hasOwn(member, "phone")));
});

test("CASO 9 — MANAGER não adiciona outro MANAGER", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.MANAGER]);
  const target = await createUser();

  await expectTeamError(
    addExistingMember({
      propertyId: team.property.id,
      actorUserId: team.users[1].id,
      phone: target.phone,
      role: PropertyRole.MANAGER,
    }),
    "FORBIDDEN",
  );
  assert.equal(
    await db.propertyMember.count({
      where: { propertyId: team.property.id, userId: target.id },
    }),
    0,
  );
});

test("CASO 10 — MANAGER não altera OWNER", async () => {
  const team = await createTeam([
    PropertyRole.OWNER,
    PropertyRole.OWNER,
    PropertyRole.MANAGER,
  ]);

  await expectTeamError(
    changeMemberRole({
      propertyId: team.property.id,
      actorUserId: team.users[2].id,
      targetUserId: team.users[1].id,
      newRole: PropertyRole.VIEWER,
    }),
    "FORBIDDEN",
  );
  assert.equal(
    (
      await db.propertyMember.findUniqueOrThrow({
        where: {
          propertyId_userId: {
            propertyId: team.property.id,
            userId: team.users[1].id,
          },
        },
      })
    ).role,
    PropertyRole.OWNER,
  );
});

test("CASO 11 — EMPLOYEE não administra equipe", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.EMPLOYEE]);
  const target = await createUser();

  await expectTeamError(
    addExistingMember({
      propertyId: team.property.id,
      actorUserId: team.users[1].id,
      phone: target.phone,
      role: PropertyRole.EMPLOYEE,
    }),
    "FORBIDDEN",
  );
});

test("CASO 12 — VIEWER não administra equipe", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.VIEWER]);
  const target = await createUser();

  await expectTeamError(
    addExistingMember({
      propertyId: team.property.id,
      actorUserId: team.users[1].id,
      phone: target.phone,
      role: PropertyRole.VIEWER,
    }),
    "FORBIDDEN",
  );
});

test("CASO 13 — último OWNER não pode ser removido", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.MANAGER]);

  await expectTeamError(
    removeMember({
      propertyId: team.property.id,
      actorUserId: team.users[1].id,
      targetUserId: team.users[0].id,
    }),
    "LAST_OWNER",
  );
  assert.equal(
    await db.propertyMember.count({
      where: { propertyId: team.property.id, role: PropertyRole.OWNER },
    }),
    1,
  );
});

test("CASO 14 — último OWNER não pode ser rebaixado", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.MANAGER]);

  await expectTeamError(
    changeMemberRole({
      propertyId: team.property.id,
      actorUserId: team.users[1].id,
      targetUserId: team.users[0].id,
      newRole: PropertyRole.VIEWER,
    }),
    "LAST_OWNER",
  );
  assert.equal(
    (
      await db.propertyMember.findUniqueOrThrow({
        where: {
          propertyId_userId: {
            propertyId: team.property.id,
            userId: team.users[0].id,
          },
        },
      })
    ).role,
    PropertyRole.OWNER,
  );
});

test("CASO 15 — ator não remove nem altera a própria membership", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.OWNER]);
  const command = {
    propertyId: team.property.id,
    actorUserId: team.users[0].id,
    targetUserId: team.users[0].id,
  };

  await expectTeamError(removeMember(command), "SELF_MANAGEMENT");
  await expectTeamError(
    changeMemberRole({ ...command, newRole: PropertyRole.MANAGER }),
    "SELF_MANAGEMENT",
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: team.property.id } }),
    0,
  );
});

test("CASO 16 — remover membro preserva User e membership em outra Property", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.EMPLOYEE]);
  const otherProperty = await createProperty("Outra propriedade");
  await db.propertyMember.create({
    data: {
      propertyId: otherProperty.id,
      userId: team.users[1].id,
      role: PropertyRole.VIEWER,
    },
  });

  await removeMember({
    propertyId: team.property.id,
    actorUserId: team.users[0].id,
    targetUserId: team.users[1].id,
  });

  assert.ok(await db.user.findUnique({ where: { id: team.users[1].id } }));
  assert.equal(
    await db.propertyMember.count({
      where: { propertyId: team.property.id, userId: team.users[1].id },
    }),
    0,
  );
  assert.equal(
    await db.propertyMember.count({
      where: { propertyId: otherProperty.id, userId: team.users[1].id },
    }),
    1,
  );
});

test("CASO 17 — remoção de membership preserva FarmRecord e StockMovement históricos", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.EMPLOYEE]);
  const productName = `Produto histórico ${token().slice(0, 8)}`;
  const product = await db.stockProduct.create({
    data: {
      propertyId: team.property.id,
      name: productName,
      normalizedName: productName.toLocaleLowerCase("pt-BR"),
      category: "OTHER",
      quantity: new Prisma.Decimal(1),
      unit: "un",
    },
  });
  const record = await db.farmRecord.create({
    data: {
      propertyId: team.property.id,
      createdByUserId: team.users[1].id,
      type: FarmRecordType.NOTE,
      description: "Histórico anterior à remoção",
    },
  });
  const movement = await db.stockMovement.create({
    data: {
      propertyId: team.property.id,
      productId: product.id,
      type: StockMovementType.ADJUSTMENT,
      quantityChange: new Prisma.Decimal(1),
      productNameSnapshot: product.name,
      unitSnapshot: product.unit,
      balanceBefore: new Prisma.Decimal(0),
      balanceAfter: new Prisma.Decimal(1),
      createdByUserId: team.users[1].id,
      source: RecordSource.WEB,
      reason: "Histórico anterior à remoção",
    },
  });

  await removeMember({
    propertyId: team.property.id,
    actorUserId: team.users[0].id,
    targetUserId: team.users[1].id,
  });

  assert.ok(await db.farmRecord.findUnique({ where: { id: record.id } }));
  assert.ok(await db.stockMovement.findUnique({ where: { id: movement.id } }));
});

test("CASO 18 — add/change/remove auditam ator e estados na mesma membership", async () => {
  const team = await createTeam([PropertyRole.OWNER]);
  const target = await createUser();
  const membership = await addExistingMember({
    propertyId: team.property.id,
    actorUserId: team.users[0].id,
    phone: target.phone,
    role: PropertyRole.EMPLOYEE,
  });
  await changeMemberRole({
    propertyId: team.property.id,
    actorUserId: team.users[0].id,
    targetUserId: target.id,
    newRole: PropertyRole.VIEWER,
  });
  await removeMember({
    propertyId: team.property.id,
    actorUserId: team.users[0].id,
    targetUserId: target.id,
  });

  const audits = await db.auditLog.findMany({
    where: {
      propertyId: team.property.id,
      entityType: "PropertyMember",
      entityId: membership.id,
    },
  });
  assert.equal(audits.length, 3);
  assert.ok(audits.every((audit) => audit.actorUserId === team.users[0].id));
  assert.ok(audits.every((audit) =>
    JSON.stringify(audit.metadata) === JSON.stringify({ targetUserId: target.id })
  ));
  const byAction = new Map(audits.map((audit) => [audit.action, audit]));
  assert.deepEqual(byAction.get("PROPERTY_MEMBER_ADDED")?.afterData, {
    role: PropertyRole.EMPLOYEE,
  });
  assert.deepEqual(byAction.get("PROPERTY_MEMBER_ROLE_CHANGED")?.beforeData, {
    role: PropertyRole.EMPLOYEE,
  });
  assert.deepEqual(byAction.get("PROPERTY_MEMBER_ROLE_CHANGED")?.afterData, {
    role: PropertyRole.VIEWER,
  });
  assert.deepEqual(byAction.get("PROPERTY_MEMBER_REMOVED")?.beforeData, {
    role: PropertyRole.VIEWER,
  });
});

test("CASO 19 — ator da Property A não modifica memberships da Property B", async () => {
  const [teamA, teamB] = await Promise.all([
    createTeam([PropertyRole.OWNER, PropertyRole.MANAGER]),
    createTeam([PropertyRole.OWNER, PropertyRole.EMPLOYEE]),
  ]);
  const standalone = await createUser();

  await expectTeamError(
    changeMemberRole({
      propertyId: teamB.property.id,
      actorUserId: teamA.users[0].id,
      targetUserId: teamB.users[1].id,
      newRole: PropertyRole.VIEWER,
    }),
    "PROPERTY_ACCESS_DENIED",
  );
  await expectTeamError(
    addExistingMember({
      propertyId: teamB.property.id,
      actorUserId: teamA.users[1].id,
      phone: standalone.phone,
      role: PropertyRole.EMPLOYEE,
    }),
    "PROPERTY_ACCESS_DENIED",
  );
  await expectTeamError(
    removeMember({
      propertyId: teamA.property.id,
      actorUserId: teamA.users[0].id,
      targetUserId: teamB.users[1].id,
    }),
    "MEMBER_NOT_FOUND",
  );

  assert.equal(
    (
      await db.propertyMember.findUniqueOrThrow({
        where: {
          propertyId_userId: {
            propertyId: teamB.property.id,
            userId: teamB.users[1].id,
          },
        },
      })
    ).role,
    PropertyRole.EMPLOYEE,
  );
  assert.equal(
    await db.auditLog.count({ where: { propertyId: teamB.property.id } }),
    0,
  );
});

test("CASO 20 — alterações concorrentes nunca deixam a Property sem OWNER", async () => {
  const team = await createTeam([PropertyRole.OWNER, PropertyRole.OWNER]);

  const results = await Promise.allSettled([
    removeMember({
      propertyId: team.property.id,
      actorUserId: team.users[0].id,
      targetUserId: team.users[1].id,
    }),
    removeMember({
      propertyId: team.property.id,
      actorUserId: team.users[1].id,
      targetUserId: team.users[0].id,
    }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof TeamDomainError);
  assert.ok([
    "LAST_OWNER",
    "PROPERTY_ACCESS_DENIED",
    "MEMBER_NOT_FOUND",
    "CONCURRENCY_CONFLICT",
  ].includes(rejected.reason.code));
  assert.equal(
    await db.propertyMember.count({
      where: { propertyId: team.property.id, role: PropertyRole.OWNER },
    }),
    1,
  );
  assert.equal(
    await db.auditLog.count({
      where: {
        propertyId: team.property.id,
        action: "PROPERTY_MEMBER_REMOVED",
      },
    }),
    1,
  );
});
