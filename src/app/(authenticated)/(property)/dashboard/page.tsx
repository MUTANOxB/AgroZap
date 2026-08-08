import { DashboardClient } from "./dashboard-client";
import { getCurrentPropertyDashboardSummary } from "@/services/rural/rural-query.service";

export default async function DashboardPage() {
  const summary = await getCurrentPropertyDashboardSummary();

  return <DashboardClient summary={summary} />;
}
