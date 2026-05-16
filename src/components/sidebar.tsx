"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FileDown,
  Users,
  Truck,
  Landmark,
  FolderOpen,
  Receipt,
  BarChart3,
  Settings,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Prehľad",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    section: "Doklady",
    items: [
      { href: "/invoices/issued", label: "Faktúry vystavené", icon: FileDown },
      {
        href: "/invoices/received",
        label: "Faktúry prijaté",
        icon: FileText,
        soon: true,
      },
      { href: "/bank", label: "Banka", icon: Landmark, soon: true },
      {
        href: "/documents",
        label: "Dokumenty",
        icon: FolderOpen,
        soon: true,
      },
    ],
  },
  {
    section: "Partneri",
    items: [
      { href: "/customers", label: "Klienti", icon: Users },
      {
        href: "/suppliers",
        label: "Dodávatelia",
        icon: Truck,
        soon: true,
      },
    ],
  },
  {
    section: "Dane & reporty",
    items: [
      { href: "/vat", label: "DPH výkazy", icon: Receipt },
      { href: "/reports", label: "Reporty", icon: BarChart3, soon: true },
    ],
  },
  {
    section: "",
    items: [
      { href: "/settings", label: "Nastavenia", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Workspace card */}
      <div className="px-3 pt-3 pb-2">
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors"
        >
          <div className="h-8 w-8 shrink-0 rounded-md bg-foreground text-background flex items-center justify-center font-serif text-sm font-medium">
            Ú
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-sidebar-foreground truncate">
              Účtovníctvo
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              MVP · DiusAI
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
        {NAV.map((section, si) => (
          <div key={si}>
            {section.section && (
              <div className="px-2 mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {section.section}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.soon ? "#" : item.href}
                      aria-disabled={item.soon}
                      onClick={(e) => item.soon && e.preventDefault()}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                        item.soon && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <button
          type="button"
          className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent transition-colors"
        >
          <div className="h-7 w-7 shrink-0 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[11px] font-medium">
            MC
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[12px] font-medium text-sidebar-foreground truncate">
              Matúš Chmeliar
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              matus.chmeliar@dius.ai
            </div>
          </div>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}
