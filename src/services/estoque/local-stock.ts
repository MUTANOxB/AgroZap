import { StockDomainError } from "./errors";

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
