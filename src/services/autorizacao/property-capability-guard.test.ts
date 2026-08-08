import assert from "node:assert/strict";
import test from "node:test";
import { PropertyRole } from "@/generated/prisma/enums";
import {
  CAPABILITIES,
  type Capability,
} from "./property-role-policy";
import {
  PropertyCapabilityError,
  requirePropertyCapabilities,
  requirePropertyCapability,
} from "./property-capability-guard";

const expectedByRole: Record<PropertyRole, readonly Capability[]> = {
  [PropertyRole.OWNER]: CAPABILITIES,
  [PropertyRole.MANAGER]: CAPABILITIES,
  [PropertyRole.EMPLOYEE]: [
    "READ_PROPERTY",
    "CREATE_RECORD",
    "MOVE_STOCK",
  ],
  [PropertyRole.VIEWER]: ["READ_PROPERTY"],
};

test("guard aplica toda a matriz real de capabilities", () => {
  for (const role of Object.values(PropertyRole)) {
    const expected = new Set(expectedByRole[role]);

    for (const capability of CAPABILITIES) {
      if (expected.has(capability)) {
        assert.doesNotThrow(() =>
          requirePropertyCapability(role, capability),
        );
      } else {
        assert.throws(
          () => requirePropertyCapability(role, capability),
          (error: unknown) => {
            assert.ok(error instanceof PropertyCapabilityError);
            assert.equal(error.code, "FORBIDDEN");
            assert.equal(
              error.message,
              "Você não tem permissão para realizar esta operação.",
            );
            return true;
          },
        );
      }
    }
  }
});

test("guard combinado exige todas as capabilities e remove duplicatas", () => {
  assert.doesNotThrow(() =>
    requirePropertyCapabilities(PropertyRole.EMPLOYEE, [
      "CREATE_RECORD",
      "MOVE_STOCK",
      "MOVE_STOCK",
    ]),
  );

  assert.throws(
    () =>
      requirePropertyCapabilities(PropertyRole.EMPLOYEE, [
        "CREATE_RECORD",
        "ADJUST_STOCK",
        "ADJUST_STOCK",
      ]),
    (error: unknown) => {
      assert.ok(error instanceof PropertyCapabilityError);
      assert.deepEqual(error.requiredCapabilities, [
        "CREATE_RECORD",
        "ADJUST_STOCK",
      ]);
      return true;
    },
  );
});
