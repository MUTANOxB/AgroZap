import { StockDomainError } from "./errors";

export function requireValidLocalStockProduct<T>(
  product: T | null | undefined,
): T {
  if (product === null || product === undefined) {
    throw new StockDomainError(
      "PRODUCT_NOT_FOUND",
      "Selecione um produto válido para movimentar o estoque.",
    );
  }

  return product;
}

export function parseRequiredLocalStockQuantity(value: string) {
  const quantity = value.trim() === "" ? Number.NaN : Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new StockDomainError(
      "INVALID_QUANTITY",
      "Informe uma quantidade válida para movimentar o estoque.",
    );
  }

  return quantity;
}

/** Regra temporária usada pelo Context enquanto as telas ainda estão no navegador. */
export function calculateLocalStockBalance(currentBalance: number, change: number) {
  if (!Number.isFinite(change) || change === 0) {
    throw new StockDomainError(
      "INVALID_QUANTITY",
      "Informe uma quantidade válida para movimentar o estoque.",
    );
  }

  const nextBalance = currentBalance + change;

  if (nextBalance < 0) {
    throw new StockDomainError("INSUFFICIENT_STOCK", "Estoque insuficiente.");
  }

  return nextBalance;
}
