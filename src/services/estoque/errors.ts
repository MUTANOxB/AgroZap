export type StockErrorCode =
  | "INVALID_QUANTITY"
  | "PROPERTY_NOT_ACTIVE"
  | "PROPERTY_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "RELATED_ENTITY_NOT_FOUND"
  | "USER_NOT_ACTIVE_PROPERTY_MEMBER"
  | "INSUFFICIENT_STOCK"
  | "MOVEMENT_NOT_FOUND"
  | "MOVEMENT_ALREADY_REVERSED"
  | "INVALID_REVERSAL"
  | "CONCURRENCY_CONFLICT";

export class StockDomainError extends Error {
  constructor(
    public readonly code: StockErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StockDomainError";
  }
}

export function getStockErrorMessage(error: unknown) {
  return error instanceof StockDomainError
    ? error.message
    : "Não foi possível alterar o estoque.";
}
