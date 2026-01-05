export type ExpenseStatus = "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
export type ExpenseActorRole = "ORG_ADMIN" | "STAFF";

export function canEditExpense(args: {
  role: ExpenseActorRole;
  status: ExpenseStatus;
}) {
  const { role, status } = args;

  if (role === "STAFF") {
    return status === "PENDING" || status === "WARNING";
  }

  // ORG_ADMIN
  return status !== "APPROVED";
}

export function canDeleteExpense(args: {
  role: ExpenseActorRole;
  status: ExpenseStatus;
}) {
  const { role, status } = args;

  if (role === "STAFF") {
    return status === "PENDING" || status === "WARNING";
  }

  // ORG_ADMIN
  return status !== "APPROVED";
}
