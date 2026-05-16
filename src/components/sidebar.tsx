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
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Prehľad",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "Doklady",
    items: [
      { href: "/invoices/issued", label: "Faktúry vystavené", icon: FileDown },
      { href: "/invoices/received", label: "Faktúry prijaté", icon: FileText, badge: "—" },
      { href: "/bank", label: "Banka", icon: Landmark, badge: "—" },
      { href: "/documents", label: "Dokumenty", icon: FolderOpen, badge: "—" },
    ],
  },
  {
    section: "Partneri",
    items: [
      { href: "/customers", label: "Klienti", icon: Users },
      { href: "/suppliers", label: "Dodávatelia", icon: Truck, badge: "—" },
    ],
  },
  {
    section: "Dane & reporty",
    items: [
      { href: "/vat", label: "DPH", icon: Receipt, badge: "—" },
      { href: "/reports", label: "Reporty", icon: BarChart3, badge: "—" },
    ],
  },
  {
    section: "",
    items: [
      { href: "/settings", label: "Nastavenia", icon: Settings, badge: "—" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="px-5 py-4 border-b border-zinc-200">
        <div className="text-sm font-semibold text-zinc-900">Účtovný AI</div>
        <div className="text-xs text-zinc-500">JARVIS Datamap · 2026</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {NAV.map((section, si) => (
          <div key={si}>
            {section.section && (
              <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {section.section}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const disabled = item.badge === "—";
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={disabled ? "#" : item.href}
                      aria-disabled={disabled}
                      onClick={(e) => disabled && e.preventDefault()}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-700 hover:bg-zinc-100",
                        disabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {disabled && (
                        <span className="text-[10px] text-zinc-400">soon</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-200 px-3 py-3 text-[11px] text-zinc-500">
        MVP demo · v0.1
      </div>
    </aside>
  );
}
