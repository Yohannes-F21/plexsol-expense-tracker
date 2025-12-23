import type { Metadata } from "next"
import { ExpensesManagement } from "@/components/org-admin/expenses-management"

export const metadata: Metadata = {
  title: "Expenses Management | Org Admin",
  description: "Manage and approve expense requests",
}

export default function ExpensesPage() {
  return <ExpensesManagement />
}
