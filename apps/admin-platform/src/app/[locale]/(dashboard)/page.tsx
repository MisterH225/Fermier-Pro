import { OverviewPageClient } from "@/components/dashboard/OverviewPageClient";
import { dashboardPageMetadata } from "@/lib/dashboard-page-metadata";

export async function generateMetadata() {
  return dashboardPageMetadata("overview");
}

export default function OverviewPage() {
  return <OverviewPageClient />;
}
