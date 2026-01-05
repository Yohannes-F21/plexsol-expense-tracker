import { redirect } from "next/navigation";

export default async function OrgAdminEditExpenseLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/expenses/${id}/edit`);
}
