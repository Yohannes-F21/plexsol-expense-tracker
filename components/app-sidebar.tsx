"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  type LucideIcon,
  Activity,
  Building2,
  CheckSquare,
  LayoutDashboard,
  Receipt,
  Shield,
  Users,
} from "lucide-react";

type NavIconId =
  | "building-2"
  | "users"
  | "receipt"
  | "activity"
  | "layout-dashboard"
  | "check-square"
  | "shield";

export interface NavItem {
  title: string;
  href: string;
  icon: NavIconId;
}

interface AppSidebarProps {
  navItems: NavItem[];
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "STAFF";
}

const iconMap: Record<NavIconId, LucideIcon> = {
  "building-2": Building2,
  users: Users,
  receipt: Receipt,
  activity: Activity,
  "layout-dashboard": LayoutDashboard,
  "check-square": CheckSquare,
  shield: Shield,
};

export function AppSidebar({ navItems, role }: AppSidebarProps) {
  const pathname = usePathname();

  const roleLabels = {
    SUPER_ADMIN: "Super Admin",
    ORG_ADMIN: "Organization Admin",
    STAFF: "Staff",
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <h2 className="text-lg font-semibold text-sidebar-foreground">
          Expense Tracker
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {roleLabels[role]}
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = iconMap[item.icon];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {Icon && <Icon className="h-5 w-5" />}
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
