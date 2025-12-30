import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/signin");
  }

  if (session.role === "SUPER_ADMIN") {
    redirect("/super-admin/dashboard");
  }

  if (session.role === "ORG_ADMIN") {
    redirect("/org-admin/dashboard");
  }

  redirect("/dashboard");
}
