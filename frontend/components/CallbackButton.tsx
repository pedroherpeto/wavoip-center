"use client";

import * as React from "react";
import { Phone, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWebphoneStore } from "@/lib/store/webphone-store";

interface CallbackButtonProps {
  phone: string;
  token?: string;
  ticketId?: number | string;
  contactName?: string;
  contactPic?: string;
  inboxName?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost";
}

export function CallbackButton({
  phone,
  token,
  ticketId,
  contactName,
  contactPic,
  inboxName,
  className,
  size = "default",
  variant = "default",
}: CallbackButtonProps) {
  const t = useTranslations("calls");
  const requestWavoipCall = useWebphoneStore((s) => s.requestWavoipCall);
  const isDialing = useWebphoneStore((s) => s.isDialing);
  const pendingPhone = useWebphoneStore((s) => s.pendingWavoipCall?.phone);

  // Loading especifico desta linha (mesmo phone) ou estado global
  const isThisDialing = isDialing || pendingPhone === phone;
  // Bloqueia QUALQUER botao enquanto qualquer chamada esta sendo discada
  const isBusy = isDialing || !!pendingPhone;

  const handleClick = React.useCallback(() => {
    if (isBusy) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(20);
    }
    requestWavoipCall({
      phone,
      token,
      ticketId,
      contactName,
      contactPic,
      inboxName,
    });
  }, [
    phone,
    token,
    ticketId,
    contactName,
    contactPic,
    inboxName,
    requestWavoipCall,
    isBusy,
  ]);

  const Icon = isThisDialing ? Loader2 : Phone;
  const iconClass = isThisDialing ? "animate-spin" : "";
  const label = isThisDialing ? "Ligando..." : t("callback");

  return (
    <>
      {/* Mobile: icon-only */}
      <Button
        variant={variant}
        size="icon"
        aria-label={label}
        aria-busy={isThisDialing}
        onClick={handleClick}
        disabled={isBusy}
        className={cn("lg:hidden", className)}
      >
        <Icon className={cn("h-5 w-5", iconClass)} />
      </Button>
      {/* Desktop: icon + label */}
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isBusy}
        aria-busy={isThisDialing}
        className={cn("hidden lg:inline-flex", className)}
      >
        <Icon className={cn("h-4 w-4", iconClass)} />
        {label}
      </Button>
    </>
  );
}
