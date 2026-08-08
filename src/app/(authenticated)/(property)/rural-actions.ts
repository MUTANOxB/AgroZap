"use server";

import { RecordSource, StockMovementType } from "@/generated/prisma/enums";
import { requirePropertyCapabilities } from "@/services/autorizacao/property-capability-guard";
import { RURAL_WEB_AUTHORIZATION } from "@/services/autorizacao/rural-web-authorization";
import {
  createStockProduct,
  updateStockProduct,
} from "@/services/estoque/product.service";
import {
  adjustStock,
  createFarmRecordWithStockMovement,
  registerStockMovement,
  reverseStockMovement,
} from "@/services/estoque/stock-movement.service";
import { requireActivePropertyContext } from "@/services/propriedades/active-property-context";
import { createFarmRecord } from "@/services/registros/farm-record.service";
import {
  ruralActionFailure,
  ruralActionSuccess,
  type RuralActionResult,
} from "@/services/rural/rural-action-result";
import {
  toAreaDto,
  toFarmRecordDto,
  toStockMovementDto,
  toStockProductDto,
  type AreaDto,
  type FarmRecordDto,
  type StockMovementDto,
  type StockProductDto,
} from "@/services/rural/rural-dtos";
import {
  prepareCreateAreaWebInput,
  prepareAdjustStockWebInput,
  prepareCreateFarmRecordWebInput,
  prepareCreateFarmRecordWithStockMovementWebInput,
  prepareCreateStockProductWebInput,
  prepareRegisterStockMovementWebInput,
  prepareReverseStockMovementWebInput,
  prepareUpdateAreaWebInput,
  prepareUpdateStockProductWebInput,
} from "@/services/rural/rural-web-inputs";
import { createArea, updateArea } from "@/services/talhoes/area.service";

export type FarmRecordWithStockMovementDto = {
  farmRecord: FarmRecordDto;
  stockMovement: StockMovementDto;
};

export async function createAreaAction(
  rawInput: unknown,
): Promise<RuralActionResult<AreaDto>> {
  const context = await requireActivePropertyContext();

  try {
    requirePropertyCapabilities(context.role, ["CREATE_AREA"]);
    const input = prepareCreateAreaWebInput(rawInput);
    const area = await createArea(
      {
        ...input,
        propertyId: context.property.id,
        createdByUserId: context.user.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    );
    return ruralActionSuccess(toAreaDto(area));
  } catch (error) {
    return ruralActionFailure(error);
  }
}

export async function updateAreaAction(
  rawInput: unknown,
): Promise<RuralActionResult<AreaDto>> {
  const context = await requireActivePropertyContext();

  try {
    requirePropertyCapabilities(context.role, ["EDIT_AREA"]);
    const input = prepareUpdateAreaWebInput(rawInput);
    const area = await updateArea(
      {
        ...input,
        propertyId: context.property.id,
        actorUserId: context.user.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    );
    return ruralActionSuccess(toAreaDto(area));
  } catch (error) {
    return ruralActionFailure(error);
  }
}

export async function createStockProductAction(
  rawInput: unknown,
): Promise<RuralActionResult<StockProductDto>> {
  const context = await requireActivePropertyContext();

  try {
    requirePropertyCapabilities(context.role, ["CREATE_PRODUCT"]);
    const input = prepareCreateStockProductWebInput(rawInput);
    if (input.initialQuantity !== "0") {
      requirePropertyCapabilities(context.role, ["ADJUST_STOCK"]);
    }
    const product = await createStockProduct(
      {
        ...input,
        propertyId: context.property.id,
        createdByUserId: context.user.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    );
    return ruralActionSuccess(toStockProductDto(product));
  } catch (error) {
    return ruralActionFailure(error);
  }
}

export async function updateStockProductAction(
  rawInput: unknown,
): Promise<RuralActionResult<StockProductDto>> {
  const context = await requireActivePropertyContext();

  try {
    requirePropertyCapabilities(context.role, ["EDIT_PRODUCT"]);
    const input = prepareUpdateStockProductWebInput(rawInput);
    const product = await updateStockProduct(
      {
        ...input,
        propertyId: context.property.id,
        actorUserId: context.user.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    );
    return ruralActionSuccess(toStockProductDto(product));
  } catch (error) {
    return ruralActionFailure(error);
  }
}

export async function adjustStockAction(
  rawInput: unknown,
): Promise<RuralActionResult<StockMovementDto>> {
  const context = await requireActivePropertyContext();

  try {
    requirePropertyCapabilities(context.role, ["ADJUST_STOCK"]);
    const input = prepareAdjustStockWebInput(rawInput);
    const movement = await adjustStock(
      {
        ...input,
        propertyId: context.property.id,
        actorUserId: context.user.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    );
    return ruralActionSuccess(toStockMovementDto(movement));
  } catch (error) {
    return ruralActionFailure(error);
  }
}

export async function createFarmRecordAction(
  rawInput: unknown,
): Promise<RuralActionResult<FarmRecordDto>> {
  const context = await requireActivePropertyContext();

  try {
    requirePropertyCapabilities(context.role, ["CREATE_RECORD"]);
    const input = prepareCreateFarmRecordWebInput(rawInput);
    const record = await createFarmRecord(
      {
        ...input,
        propertyId: context.property.id,
        createdByUserId: context.user.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    );
    return ruralActionSuccess(toFarmRecordDto(record));
  } catch (error) {
    return ruralActionFailure(error);
  }
}

export async function registerStockMovementAction(
  rawInput: unknown,
): Promise<RuralActionResult<StockMovementDto>> {
  const context = await requireActivePropertyContext();

  try {
    const input = prepareRegisterStockMovementWebInput(rawInput);
    requirePropertyCapabilities(context.role, [
      input.type === StockMovementType.ADJUSTMENT
        ? "ADJUST_STOCK"
        : "MOVE_STOCK",
    ]);
    const movement = await registerStockMovement(
      {
        ...input,
        propertyId: context.property.id,
        createdByUserId: context.user.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    );
    return ruralActionSuccess(toStockMovementDto(movement));
  } catch (error) {
    return ruralActionFailure(error);
  }
}

export async function reverseStockMovementAction(
  rawInput: unknown,
): Promise<RuralActionResult<StockMovementDto>> {
  const context = await requireActivePropertyContext();

  try {
    requirePropertyCapabilities(context.role, ["REVERSE_STOCK"]);
    const input = prepareReverseStockMovementWebInput(rawInput);
    const movement = await reverseStockMovement(
      {
        ...input,
        propertyId: context.property.id,
        createdByUserId: context.user.id,
        source: RecordSource.WEB,
      },
      RURAL_WEB_AUTHORIZATION,
    );
    return ruralActionSuccess(toStockMovementDto(movement));
  } catch (error) {
    return ruralActionFailure(error);
  }
}

export async function createFarmRecordWithStockMovementAction(
  rawInput: unknown,
): Promise<RuralActionResult<FarmRecordWithStockMovementDto>> {
  const context = await requireActivePropertyContext();

  try {
    const input = prepareCreateFarmRecordWithStockMovementWebInput(rawInput);
    requirePropertyCapabilities(context.role, [
      "CREATE_RECORD",
      input.stockMovement.type === StockMovementType.ADJUSTMENT
        ? "ADJUST_STOCK"
        : "MOVE_STOCK",
    ]);

    const result = await createFarmRecordWithStockMovement(
      {
        farmRecord: {
          ...input.farmRecord,
          propertyId: context.property.id,
          createdByUserId: context.user.id,
          source: RecordSource.WEB,
        },
        stockMovement: input.stockMovement,
      },
      RURAL_WEB_AUTHORIZATION,
    );

    return ruralActionSuccess({
      farmRecord: toFarmRecordDto(result.farmRecord),
      stockMovement: toStockMovementDto(result.stockMovement),
    });
  } catch (error) {
    return ruralActionFailure(error);
  }
}
