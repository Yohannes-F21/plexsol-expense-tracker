import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ExpenseFormPage } from "@/components/expenses/expense-form-page";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session || (session.role !== "STAFF" && session.role !== "ORG_ADMIN")) {
    redirect("/signin");
  }

  const role = session.role;
  const { id } = await params;

  return (
    <ExpenseFormPage
      role={role}
      mode="edit"
      expenseId={id}
      backHref={`/expenses/${id}`}
    />
  );
}
