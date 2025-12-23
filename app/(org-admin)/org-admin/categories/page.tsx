import type { Metadata } from "next"
import { CategoriesManagement } from "@/components/org-admin/categories-management"

export const metadata: Metadata = {
  title: "Categories Management | Org Admin",
  description: "Manage expense categories",
}

export default function CategoriesPage() {
  return <CategoriesManagement />
}
