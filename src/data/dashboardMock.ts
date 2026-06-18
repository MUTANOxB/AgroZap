export type DashboardIconName =
  | "area"
  | "field"
  | "activity"
  | "alert"
  | "rain"
  | "droplet"
  | "wind"
  | "sun"
  | "package"
  | "calendar";

// Tipos compartilhados deixam explícito o formato esperado por cada componente.
export type SummaryMetric = {
  label: string;
  value: string;
  detail: string;
  icon: DashboardIconName;
  tone: string;
};

export type RecentActivity = {
  title: string;
  meta: string;
  time: string;
  color: string;
};

export type StockItem = {
  name: string;
  amount: string;
  level: number;
  color: string;
};

export type UpcomingTask = {
  day: string;
  month: string;
  title: string;
  detail: string;
  urgent: boolean;
};

// Todos os dados demonstrativos do dashboard ficam centralizados neste arquivo.
// Quando houver banco ou API, esta será a principal camada a ser substituída.
export const summaryMetrics: SummaryMetric[] = [
  { label: "Área em produção", value: "286 ha", detail: "72% da área da propriedade", icon: "area", tone: "bg-emerald-100 text-emerald-700" },
  { label: "Locais cadastrados", value: "12", detail: "8 lavouras · 4 pastos", icon: "field", tone: "bg-amber-100 text-amber-700" },
  { label: "Anotações no mês", value: "38", detail: "+12% comparado a maio", icon: "activity", tone: "bg-sky-100 text-sky-700" },
  { label: "Pendências", value: "3", detail: "2 no estoque · 1 vencimento", icon: "alert", tone: "bg-rose-100 text-rose-700" },
];

export const recentActivities: RecentActivity[] = [
  { title: "Pulverização feita", meta: "Lavoura Norte · Soja", time: "Hoje, 07:30", color: "bg-emerald-500" },
  { title: "Entrada de ureia no estoque", meta: "Estoque principal · 1.200 kg", time: "Ontem, 16:45", color: "bg-sky-500" },
  { title: "Vistoria de pragas", meta: "Roça do fundo · Milho", time: "16 jun, 10:20", color: "bg-amber-500" },
  { title: "Revisão do trator", meta: "John Deere 6110J", time: "15 jun, 14:00", color: "bg-violet-500" },
];

export const stockItems: StockItem[] = [
  { name: "Semente de soja", amount: "3.450 kg", level: 78, color: "bg-emerald-500" },
  { name: "Adubo NPK", amount: "1.280 kg", level: 42, color: "bg-sky-500" },
  { name: "Produto para controle de mato", amount: "86 L", level: 24, color: "bg-amber-500" },
  { name: "Óleo diesel", amount: "620 L", level: 18, color: "bg-rose-500" },
];

export const upcomingTasks: UpcomingTask[] = [
  { day: "21", month: "JUN", title: "Revisão do pulverizador", detail: "Vence em 3 dias", urgent: true },
  { day: "25", month: "JUN", title: "Pagamento fornecedor", detail: "Cooperativa Vale Verde", urgent: false },
  { day: "02", month: "JUL", title: "Coleta de terra para análise", detail: "Lavoura do milho, Horta principal e Pomar", urgent: false },
];
