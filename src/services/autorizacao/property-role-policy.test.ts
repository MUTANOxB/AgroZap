import assert from "node:assert/strict";
import test from "node:test";
import { PropertyRole } from "@/generated/prisma/enums";
import {
  CAPABILITIES,
  authorizeMemberAddition,
  authorizeMemberRemoval,
  authorizeMemberRoleChange,
  getCapabilities,
  getRoleLabel,
  hasCapability,
  isPropertyRole,
} from "./property-role-policy";

const ALL = new Set(CAPABILITIES);

test("papéis possuem labels em PT-BR", () => {
  assert.equal(getRoleLabel(PropertyRole.OWNER), "Proprietário");
  assert.equal(getRoleLabel(PropertyRole.MANAGER), "Gerente");
  assert.equal(getRoleLabel(PropertyRole.EMPLOYEE), "Funcionário");
  assert.equal(getRoleLabel(PropertyRole.VIEWER), "Visualizador");
});

test("OWNER e MANAGER possuem todas as capabilities operacionais", () => {
  assert.deepEqual(new Set(getCapabilities(PropertyRole.OWNER)), ALL);
  assert.deepEqual(new Set(getCapabilities(PropertyRole.MANAGER)), ALL);
});

test("EMPLOYEE pode ler, registrar e movimentar estoque", () => {
  assert.deepEqual(new Set(getCapabilities(PropertyRole.EMPLOYEE)), new Set([
    "READ_PROPERTY",
    "CREATE_RECORD",
    "MOVE_STOCK",
  ]));
  assert.equal(hasCapability(PropertyRole.EMPLOYEE, "MANAGE_TEAM"), false);
  assert.equal(hasCapability(PropertyRole.EMPLOYEE, "CREATE_AREA"), false);
});

test("VIEWER possui somente leitura", () => {
  assert.deepEqual(getCapabilities(PropertyRole.VIEWER), ["READ_PROPERTY"]);
  assert.equal(hasCapability(PropertyRole.VIEWER, "CREATE_RECORD"), false);
});

test("OWNER pode adicionar qualquer papel", () => {
  for (const role of Object.values(PropertyRole)) {
    assert.deepEqual(authorizeMemberAddition(PropertyRole.OWNER, role), {
      allowed: true,
    });
  }
});

test("MANAGER adiciona somente EMPLOYEE ou VIEWER", () => {
  assert.deepEqual(
    authorizeMemberAddition(PropertyRole.MANAGER, PropertyRole.EMPLOYEE),
    { allowed: true },
  );
  assert.deepEqual(
    authorizeMemberAddition(PropertyRole.MANAGER, PropertyRole.VIEWER),
    { allowed: true },
  );
  assert.deepEqual(
    authorizeMemberAddition(PropertyRole.MANAGER, PropertyRole.MANAGER),
    { allowed: false, reason: "FORBIDDEN" },
  );
  assert.deepEqual(
    authorizeMemberAddition(PropertyRole.MANAGER, PropertyRole.OWNER),
    { allowed: false, reason: "FORBIDDEN" },
  );
});

test("EMPLOYEE e VIEWER não administram equipe", () => {
  for (const actorRole of [PropertyRole.EMPLOYEE, PropertyRole.VIEWER]) {
    assert.deepEqual(
      authorizeMemberAddition(actorRole, PropertyRole.EMPLOYEE),
      { allowed: false, reason: "FORBIDDEN" },
    );
    assert.deepEqual(
      authorizeMemberRemoval({
        actorUserId: "actor",
        actorRole,
        targetUserId: "target",
        targetRole: PropertyRole.VIEWER,
      }),
      { allowed: false, reason: "FORBIDDEN" },
    );
  }
});

test("MANAGER alterna somente EMPLOYEE e VIEWER", () => {
  assert.deepEqual(
    authorizeMemberRoleChange({
      actorUserId: "manager",
      actorRole: PropertyRole.MANAGER,
      targetUserId: "employee",
      targetRole: PropertyRole.EMPLOYEE,
      newRole: PropertyRole.VIEWER,
    }),
    { allowed: true },
  );
  assert.deepEqual(
    authorizeMemberRoleChange({
      actorUserId: "manager",
      actorRole: PropertyRole.MANAGER,
      targetUserId: "owner",
      targetRole: PropertyRole.OWNER,
      newRole: PropertyRole.VIEWER,
    }),
    { allowed: false, reason: "FORBIDDEN" },
  );
  assert.deepEqual(
    authorizeMemberRoleChange({
      actorUserId: "manager",
      actorRole: PropertyRole.MANAGER,
      targetUserId: "employee",
      targetRole: PropertyRole.EMPLOYEE,
      newRole: PropertyRole.MANAGER,
    }),
    { allowed: false, reason: "FORBIDDEN" },
  );
});

test("OWNER altera e remove outros OWNER ou MANAGER", () => {
  assert.deepEqual(
    authorizeMemberRoleChange({
      actorUserId: "owner-a",
      actorRole: PropertyRole.OWNER,
      targetUserId: "owner-b",
      targetRole: PropertyRole.OWNER,
      newRole: PropertyRole.MANAGER,
    }),
    { allowed: true },
  );
  assert.deepEqual(
    authorizeMemberRemoval({
      actorUserId: "owner-a",
      actorRole: PropertyRole.OWNER,
      targetUserId: "manager",
      targetRole: PropertyRole.MANAGER,
    }),
    { allowed: true },
  );
});

test("self-management é bloqueado antes das demais regras", () => {
  assert.deepEqual(
    authorizeMemberRoleChange({
      actorUserId: "same",
      actorRole: PropertyRole.OWNER,
      targetUserId: "same",
      targetRole: PropertyRole.OWNER,
      newRole: "INVALID",
    }),
    { allowed: false, reason: "SELF_MANAGEMENT" },
  );
  assert.deepEqual(
    authorizeMemberRemoval({
      actorUserId: "same",
      actorRole: PropertyRole.OWNER,
      targetUserId: "same",
      targetRole: PropertyRole.OWNER,
    }),
    { allowed: false, reason: "SELF_MANAGEMENT" },
  );
});

test("role inválido e alteração sem mudança são recusados", () => {
  assert.equal(isPropertyRole("OWNER"), true);
  assert.equal(isPropertyRole("ADMIN"), false);
  assert.deepEqual(authorizeMemberAddition(PropertyRole.OWNER, "ADMIN"), {
    allowed: false,
    reason: "INVALID_ROLE",
  });
  assert.deepEqual(
    authorizeMemberRoleChange({
      actorUserId: "owner",
      actorRole: PropertyRole.OWNER,
      targetUserId: "employee",
      targetRole: PropertyRole.EMPLOYEE,
      newRole: PropertyRole.EMPLOYEE,
    }),
    { allowed: false, reason: "ROLE_UNCHANGED" },
  );
});
