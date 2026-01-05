import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ExpenseFormPage } from "@/components/expenses/expense-form-page";

export default async function NewExpensePage() {
  const session = await getSession();

  if (!session || (session.role !== "STAFF" && session.role !== "ORG_ADMIN")) {
    redirect("/signin");
  }

  const role = session.role;

  return <ExpenseFormPage role={role} mode="create" backHref="/expenses" />;
}
