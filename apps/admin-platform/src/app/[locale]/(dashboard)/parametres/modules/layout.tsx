import type { ReactNode } from "react";
import { dashboardPageMetadata } from "@/lib/dashboard-page-metadata";

export async function generateMetadata() {
  return dashboardPageMetadata("modules");
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
