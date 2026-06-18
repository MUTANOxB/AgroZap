import type { WeatherInfo } from "@/data/dashboardMock";
import { DashboardIcon } from "./DashboardIcon";

type WeatherCardProps = {
  weather: WeatherInfo;
};

// Apresenta o resumo climático fictício usado na demonstração do dashboard.
export function WeatherCard({ weather }: WeatherCardProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 p-6 text-white shadow-[0_14px_40px_rgba(6,78,59,0.22)]">
      <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-emerald-300/10" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-100">Clima na fazenda</p>
            <p className="mt-1 text-xs text-emerald-200">{weather.location}</p>
          </div>
          <DashboardIcon name="sun" className="h-10 w-10 text-amber-300" />
        </div>
        <div className="mt-5 flex items-end gap-3">
          <strong className="text-6xl font-light tracking-tighter">{weather.temperature}</strong>
          <div className="pb-1">
            <p className="font-semibold">{weather.condition}</p>
            <p className="text-xs text-emerald-200">{weather.feelsLike}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/10 py-3 backdrop-blur-sm">
          {weather.details.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1 text-xs">
              <DashboardIcon name={item.icon} className="h-4 w-4 text-sky-200" />
              <span className="text-emerald-100">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-amber-300/15 px-3 py-2 text-xs font-medium text-amber-100">
          {weather.forecast}
        </p>
      </div>
    </section>
  );
}
