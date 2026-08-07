import { StockDomainError } from "./errors";

type PropertyArchiveState = {
  archivedAt: Date | null;
};

export function requireActivePropertyForNewStockMovement<
  T extends PropertyArchiveState,
>(property: T | null): T {
  if (!property || property.archivedAt !== null) {
    throw new StockDomainError(
      "PROPERTY_NOT_ACTIVE",
      "Propriedade não encontrada ou arquivada.",
    );
  }

  return property;
}

export function requireExistingPropertyForStockReversal<
  T extends PropertyArchiveState,
>(property: T | null): T {
  if (!property) {
    throw new StockDomainError(
      "PROPERTY_NOT_FOUND",
      "Propriedade não encontrada.",
    );
  }

  return property;
}
