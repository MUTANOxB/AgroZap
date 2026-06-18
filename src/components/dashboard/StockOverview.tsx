import type { StockItem } from "@/data/dashboardMock";
import { DashboardPanel } from "./DashboardPanel";

type StockOverviewProps = {
  items: StockItem[];
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
      <div className="space-y-5 p-5">
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{item.name}</span>
              <span className="font-semibold text-slate-900">{item.amount}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.level}%` }} />
            </div>
            {item.level < 25 && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600">
                Estoque abaixo do mínimo
              </p>
            )}
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}
