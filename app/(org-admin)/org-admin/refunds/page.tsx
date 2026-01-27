import type { Metadata } from "next";
import { RefundsPage } from "@/components/org-admin/refunds-page";

export const metadata: Metadata = {
  title: "Refunds | Org Admin",
  description: "Transfer funds between bank accounts",
};

export default function Refunds() {
  return <RefundsPage />;
}
