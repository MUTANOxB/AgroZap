import type { ReactNode } from "react";
import type { DashboardIconName } from "@/data/dashboardMock";

export type { DashboardIconName } from "@/data/dashboardMock";

type DashboardIconProps = {
  name: DashboardIconName;
  className?: string;
};

// Concentra os ícones usados pelo dashboard para manter o mesmo traço visual
// em todos os cards, sem depender de uma biblioteca externa.
export function DashboardIcon({ name, className = "h-5 w-5" }: DashboardIconProps) {
  const paths: Record<DashboardIconName, ReactNode> = {
    area: <><path d="M3 20h18"/><path d="m5 20 4-8 3 5 3-10 4 13"/></>,
    field: <><path d="M4 20c3-4 5-9 5-16"/><path d="M20 20c-3-4-5-9-5-16"/><path d="M4 13c3 0 5 1 7 4"/><path d="M20 13c-3 0-5 1-7 4"/></>,
    activity: <path d="M3 12h4l2-7 4 14 2-7h6"/>,
    alert: <><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.5 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z"/></>,
    rain: <><path d="M16 13a4 4 0 0 0-7.8-1A3 3 0 1 0 6 17h10a2 2 0 0 0 0-4Z"/><path d="m8 20-1 2M12 20l-1 2M16 20l-1 2"/></>,
    droplet: <path d="M12 22a7 7 0 0 0 7-7c0-5-7-13-7-13S5 10 5 15a7 7 0 0 0 7 7Z"/>,
    wind: <><path d="M3 8h10a2 2 0 1 0-2-2"/><path d="M3 12h15a2 2 0 1 1-2 2"/><path d="M3 16h8"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
    package: <><path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/><path d="M3 7.5V17l9 4.5 9-4.5V7.5M12 12v9.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
