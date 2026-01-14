import type { Metadata } from "next";
import { ReportsPage } from "@/components/org-admin/reports-page";

export const metadata: Metadata = {
  title: "Reports | Org Admin",
  description: "Download expense item reports",
};

export default function Reports() {
  return <ReportsPage />;
}
