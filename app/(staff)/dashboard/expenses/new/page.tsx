import { redirect } from "next/navigation";

export default function StaffNewExpenseLegacyRedirect() {
  redirect("/expenses/new");
}
