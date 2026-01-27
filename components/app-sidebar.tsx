"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeftRight,
  Building2,
  CheckSquare,
  LayoutDashboard,
  Receipt,
  Shield,
  Users,
  Menu,
  Tag,
  Settings,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export type NavIconId =
  | "building-2"
  | "users"
  | "receipt"
  | "activity"
  | "arrow-left-right"
  | "layout-dashboard"
  | "check-square"
  | "shield"
  | "tag"
  | "settings";

export interface NavItem {
  title: string;
  href: string;
  icon: NavIconId | LucideIcon;
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
  "arrow-left-right": ArrowLeftRight,
  "layout-dashboard": LayoutDashboard,
  "check-square": CheckSquare,
  shield: Shield,
  tag: Tag,
  settings: Settings,
};

function SidebarContent({
  navItems,
  role,
  onNavigate,
}: AppSidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();

  const roleLabels = {
    SUPER_ADMIN: "Super Admin",
    ORG_ADMIN: "Organization Admin",
    STAFF: "Staff",
  };

  return (
    <>
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
            const Icon =
              typeof item.icon === "string"
                ? iconMap[item.icon]
                : (item.icon as LucideIcon);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {Icon && <Icon className="h-5 w-5" />}
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

export function AppSidebar({ navItems, role }: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="hidden md:flex h-full w-64 flex-col border-r border-border bg-sidebar">
        <SidebarContent navItems={navItems} role={role} />
      </div>

      {mounted ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-4 left-4 z-40"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <div className="flex h-full flex-col bg-sidebar">
              <SidebarContent
                navItems={navItems}
                role={role}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-40 md:hidden"
          type="button"
          aria-label="Open navigation"
          disabled
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
    </>
  );
}
