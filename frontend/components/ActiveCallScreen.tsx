"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  PhoneOff,
  Grid3x3,
  Pencil,
  Volume2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useWebphoneStore } from "@/lib/store/webphone-store";
import {
  formatDuration,
  formatPhone,
  initials,
  cn,
} from "@/lib/utils";

const DTMF_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export function ActiveCallScreen() {
  const t = useTranslations();
  const active = useWebphoneStore((s) => s.activeCall);
  const toggleMute = useWebphoneStore((s) => s.toggleMute);
  const endCall = useWebphoneStore((s) => s.endActiveCall);
  const setNotes = useWebphoneStore((s) => s.setNotes);

  const [elapsed, setElapsed] = React.useState(0);
  const [showKeypad, setShowKeypad] = React.useState(false);
  const [showNotes, setShowNotes] = React.useState(false);

  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - active.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [active]);

  const handleDtmf = React.useCallback((key: string) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }
    // Forward to wavoip widget if available
    const w = (window as unknown as { wavoip?: { call?: { sendDTMF?: (k: string) => void } } }).wavoip;
    w?.call?.sendDTMF?.(key);
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-stretch justify-center lg:items-center lg:p-6"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="glass relative w-full lg:w-[480px] lg:max-h-[90vh] lg:rounded-3xl overflow-hidden flex flex-col"
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-14 pb-6 gap-4">
              <div className="h-28 w-28 rounded-full bg-wavoip-500/20 flex items-center justify-center text-3xl font-semibold text-wavoip-500">
                {initials(active.contactName || active.phone)}
              </div>
              <div>
                <p className="text-sm text-white/60 uppercase tracking-wide">
                  {t("call.activeTitle")}
                </p>
                <h2 className="text-2xl font-semibold text-white mt-1">
                  {active.contactName || formatPhone(active.phone)}
                </h2>
                <p className="text-base text-wavoip-500 font-mono mt-2">
                  {formatDuration(elapsed)}
                </p>
              </div>

              {showKeypad && (
                <div className="grid grid-cols-3 gap-3 w-full max-w-xs mt-2">
                  {DTMF_KEYS.flat().map((k) => (
                    <button
                      key={k}
                      onClick={() => handleDtmf(k)}
                      className="h-14 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xl font-medium"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}

              {showNotes && (
                <textarea
                  aria-label={t("call.notes")}
                  placeholder={t("call.notesPlaceholder")}
                  value={active.notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full min-h-[120px] rounded-xl bg-white/5 border border-white/10 text-white p-3 placeholder:text-white/40 focus:outline-none focus:border-wavoip-500 resize-none"
                />
              )}
            </div>

            {/* Controls */}
            <div className="grid grid-cols-4 gap-2 p-4 border-t border-white/10">
              <ControlButton
                active={active.muted}
                onClick={toggleMute}
                label={active.muted ? t("common.unmute") : t("common.mute")}
              >
                {active.muted ? (
                  <MicOff className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </ControlButton>
              <ControlButton
                active={showKeypad}
                onClick={() => setShowKeypad((v) => !v)}
                label="DTMF"
              >
                <Grid3x3 className="h-6 w-6" />
              </ControlButton>
              <ControlButton
                active={showNotes}
                onClick={() => setShowNotes((v) => !v)}
                label={t("call.notes")}
              >
                <Pencil className="h-6 w-6" />
              </ControlButton>
              <ControlButton
                active={false}
                onClick={() => {
                  // Placeholder for speaker toggle
                }}
                label="Speaker"
              >
                <Volume2 className="h-6 w-6" />
              </ControlButton>
            </div>
            <div className="px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
              <button
                onClick={endCall}
                className="w-full h-16 rounded-2xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold flex items-center justify-center gap-2"
                aria-label={t("common.hangup")}
              >
                <PhoneOff className="h-6 w-6" />
                {t("common.hangup")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center justify-center gap-1 h-16 rounded-xl text-white text-xs transition-colors",
        active
          ? "bg-wavoip-500 text-black"
          : "bg-white/10 hover:bg-white/20 active:bg-white/30"
      )}
    >
      {children}
    </button>
  );
}
