import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ExpenseDetailPage } from "@/components/expenses/expense-detail-page";

export default async function ExpenseDetailPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect(
      `/api/auth/signout?next=${encodeURIComponent("/unauthorized?code=401")}`,
    );
  }

  if (session.role !== "STAFF" && session.role !== "ORG_ADMIN") {
    redirect("/unauthorized?code=403");
  }

  const role = session.role;
  const { id } = await params;

  return <ExpenseDetailPage role={role} expenseId={id} backHref="/expenses" />;
}
