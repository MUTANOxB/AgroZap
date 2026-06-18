import { useClima } from "@/hooks/useClima";
import { DashboardIcon } from "./DashboardIcon";

function formatValue(value: number | null, suffix: string) {
  return value === null ? "Não informado" : `${Math.round(value)}${suffix}`;
}

// O card mantém o visual original, mas agora busca dados reais na rota interna.
export function WeatherCard() {
  const { clima, isLoading, error } = useClima();

  if (isLoading) {
    return (
      <section className="flex min-h-80 items-center justify-center rounded-[1.15rem] border border-emerald-800/50 bg-emerald-900 p-6 text-emerald-100 shadow-[0_14px_34px_rgba(6,78,59,0.16)]">
        <p className="animate-pulse text-sm font-semibold">Carregando clima...</p>
      </section>
    );
  }

  if (error || !clima) {
    return (
      <section className="flex min-h-80 flex-col items-center justify-center rounded-[1.15rem] border border-emerald-800/50 bg-emerald-900 p-6 text-center text-white shadow-[0_14px_34px_rgba(6,78,59,0.16)]">
        <DashboardIcon name="alert" className="h-8 w-8 text-amber-300" />
        <p className="mt-3 font-semibold">Clima indisponível</p>
        <p className="mt-1 text-sm text-emerald-200">
          Tente atualizar a página em alguns minutos.
        </p>
      </section>
    );
  }

  const details = [
    { icon: "droplet" as const, label: "Umidade", value: formatValue(clima.umidade, "%") },
    { icon: "wind" as const, label: "Vento", value: formatValue(clima.vento, " km/h") },
    { icon: "rain" as const, label: "Chuva", value: formatValue(clima.chanceChuva, "%") },
  ];

  return (
    <section className="relative overflow-hidden rounded-[1.15rem] border border-emerald-800/50 bg-[linear-gradient(145deg,#124b38_0%,#176247_60%,#346d50_100%)] p-5 text-white shadow-[0_14px_34px_rgba(6,78,59,0.16)] sm:p-6">
      <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-emerald-300/10" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-100">Clima na fazenda</p>
            <p className="mt-1 text-xs text-emerald-200">{clima.local}</p>
          </div>
          <DashboardIcon name="sun" className="h-10 w-10 text-amber-300" />
        </div>
        <div className="mt-5 flex items-end gap-3">
          <strong className="text-5xl font-light tracking-tighter sm:text-6xl">
            {clima.temperatura === null ? "—" : `${Math.round(clima.temperatura)}°`}
          </strong>
          <div className="pb-1">
            <p className="font-semibold">{clima.condicao}</p>
            <p className="text-xs text-emerald-200">
              {clima.sensacao === null
                ? "Sensação não informada"
                : `Sensação de ${Math.round(clima.sensacao)}°C`}
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/10 py-3 backdrop-blur-sm">
          {details.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1 text-xs">
              <DashboardIcon name={item.icon} className="h-4 w-4 text-sky-200" />
              <span className="text-emerald-100">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        {clima.aviso && (
          <p className="mt-4 rounded-lg bg-amber-300/15 px-3 py-2 text-xs font-medium text-amber-100">
            {clima.aviso}
          </p>
        )}
      </div>
    </section>
  );
}
