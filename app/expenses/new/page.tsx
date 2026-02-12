import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ExpenseFormPage } from "@/components/expenses/expense-form-page";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
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

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const typeParam = (resolvedSearchParams?.type ?? "").toUpperCase();
  const initialType =
    typeParam === "PAYMENT_VOUCHER" || typeParam === "GENERAL"
      ? (typeParam as "PAYMENT_VOUCHER" | "GENERAL")
      : "RECEIPT";

  return (
    <ExpenseFormPage
      role={role}
      mode="create"
      backHref="/expenses"
      initialType={initialType}
    />
  );
}
