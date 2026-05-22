"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Phone,
  Settings,
  Menu,
  Smartphone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationsToggle } from "@/components/NotificationsBridge";

const NAV = [
  { href: "/", icon: LayoutDashboard, key: "dashboard" },
  { href: "/sessions", icon: Smartphone, key: "sessions" },
  { href: "/calls", icon: Phone, key: "calls" },
  { href: "/settings", icon: Settings, key: "settings" },
] as const;

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors min-h-[44px]",
              active
                ? "bg-wavoip-500/10 text-wavoip-500"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <img
        src="/wavoip.png"
        alt="Wavoip"
        className="h-9 w-9 rounded-xl object-contain"
      />
      <div className="flex flex-col leading-tight">
        <span className="font-semibold">Wavoip</span>
        <span className="text-xs text-[var(--muted-foreground)]">PABX</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-[var(--background)]/80 backdrop-blur px-3 h-14">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-4 w-72">
            <div className="mb-6">
              <Brand />
            </div>
            <NavItems onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Brand />
        <ThemeToggle />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 border-r bg-[var(--card)] p-4">
        <div className="mb-8">
          <Brand />
        </div>
        <NavItems />
        <div className="mt-auto flex flex-col gap-2 items-stretch">
          <NotificationsToggle />
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
