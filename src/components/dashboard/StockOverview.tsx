import { DashboardPanel } from "./DashboardPanel";

export type StockOverviewItem = {
  id: string;
  name: string;
  amount: string;
  isLowStock: boolean;
};

type StockOverviewProps = {
  items: StockOverviewItem[];
};

// Resume a quantidade disponível e destaca automaticamente itens abaixo do mínimo.
export function StockOverview({ items }: StockOverviewProps) {
  return (
    <DashboardPanel
      title="Como está o estoque"
      subtitle="Quantidade dos principais produtos e materiais"
      icon="package"
      href="/estoque"
    >
      {items.length > 0 ? (
        <div className="space-y-5 p-5">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate font-medium text-slate-700">{item.name}</span>
                <span className="shrink-0 font-semibold text-slate-900">{item.amount}</span>
              </div>
              {item.isLowStock && (
                <p className="mt-1.5 text-xs font-semibold text-rose-600">
                  Estoque abaixo do mínimo
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          Nenhum produto cadastrado.
        </p>
      )}
    </DashboardPanel>
  );
}
