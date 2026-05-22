"use client";

import * as React from "react";
import { Delete, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useWebphoneStore } from "@/lib/store/webphone-store";
import { formatPhone, cn } from "@/lib/utils";

const KEYS: { digit: string; letters?: string }[][] = [
  [
    { digit: "1" },
    { digit: "2", letters: "ABC" },
    { digit: "3", letters: "DEF" },
  ],
  [
    { digit: "4", letters: "GHI" },
    { digit: "5", letters: "JKL" },
    { digit: "6", letters: "MNO" },
  ],
  [
    { digit: "7", letters: "PQRS" },
    { digit: "8", letters: "TUV" },
    { digit: "9", letters: "WXYZ" },
  ],
  [{ digit: "*" }, { digit: "0", letters: "+" }, { digit: "#" }],
];

export function Dialer() {
  const t = useTranslations();
  const requestWavoipCall = useWebphoneStore((s) => s.requestWavoipCall);
  const [value, setValue] = React.useState("");

  const press = React.useCallback((d: string) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(20);
    }
    setValue((v) => v + d);
  }, []);

  const longPressZero = React.useRef<NodeJS.Timeout | null>(null);

  const startZero = () => {
    longPressZero.current = setTimeout(() => {
      setValue((v) => v + "+");
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, 500);
  };
  const cancelZero = () => {
    if (longPressZero.current) {
      clearTimeout(longPressZero.current);
      longPressZero.current = null;
    }
  };

  const clearOne = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
    setValue((v) => v.slice(0, -1));
  };

  const handleCall = () => {
    if (!value.trim()) return;
    requestWavoipCall({ phone: value.trim() });
  };

  return (
    <div className="mx-auto max-w-md w-full flex flex-col gap-6">
      <div className="text-center">
        <input
          type="tel"
          value={formatPhone(value) || value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d+*#]/g, ""))}
          placeholder={t("dialer.placeholder")}
          aria-label={t("dialer.placeholder")}
          className="w-full bg-transparent text-center text-3xl font-mono py-4 focus:outline-none placeholder:text-[var(--muted-foreground)]"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.flat().map((k) => {
          const isZero = k.digit === "0";
          return (
            <button
              key={k.digit}
              onClick={() => press(k.digit)}
              onTouchStart={isZero ? startZero : undefined}
              onTouchEnd={isZero ? cancelZero : undefined}
              onMouseDown={isZero ? startZero : undefined}
              onMouseUp={isZero ? cancelZero : undefined}
              onMouseLeave={isZero ? cancelZero : undefined}
              className={cn(
                "h-14 lg:h-16 rounded-2xl bg-[var(--muted)] hover:bg-[var(--muted)]/70 active:scale-95 transition flex flex-col items-center justify-center"
              )}
              aria-label={`Key ${k.digit}`}
            >
              <span className="text-2xl font-semibold">{k.digit}</span>
              {k.letters && (
                <span className="text-[10px] text-[var(--muted-foreground)] tracking-widest">
                  {k.letters}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div />
        <Button
          onClick={handleCall}
          disabled={!value.trim()}
          aria-label={t("common.accept")}
          className="h-16 w-16 rounded-full"
          size="icon"
        >
          <Phone className="h-7 w-7" />
        </Button>
        <button
          onClick={clearOne}
          aria-label={t("dialer.clear")}
          className="justify-self-start h-12 w-12 rounded-full flex items-center justify-center hover:bg-[var(--muted)]"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
