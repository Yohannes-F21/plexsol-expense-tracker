import type { Metadata } from "next";
import { StaffRefundsPage } from "@/components/staff/refunds-page";

export const metadata: Metadata = {
  title: "Refunds | Staff",
  description: "Create and track refund requests",
};

export default function RefundsPage() {
  return <StaffRefundsPage />;
}
