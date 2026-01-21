import { BackButton } from "@/components/back-button";
import { BankAccountsManagement } from "@/components/org-admin/bank-accounts-management";

export default function OrgAdminBankAccountsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <BackButton href="/org-admin/settings" />
        <div className="pt-0.5">
          <h1 className="text-2xl font-semibold">Bank Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage bank accounts used for bank transfer payments.
          </p>
        </div>
      </div>

      <BankAccountsManagement />
    </div>
  );
}
