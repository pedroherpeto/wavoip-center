"use client";

import * as React from "react";
import { Phone } from "lucide-react";
import { useWebphoneStore } from "@/lib/store/webphone-store";

// Regex pra numero E.164 brasileiro/internacional:
//   +55 11 99999-9999, 5511999999999, (11) 99999-9999, etc.
// Min 8 digitos, max 15 (E.164). Aceita +, espacos, () e -.
const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;

function normalize(text: string): string {
  return text.replace(/\D/g, "");
}

function isValidE164(text: string): boolean {
  const digits = normalize(text);
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Renderiza um texto detectando numeros E.164 e tornando-os clicaveis.
 * Click -> abre confirmacao e dispara requestWavoipCall.
 *
 * Uso:
 *   <PhoneText>Liga pra 5511999999999 ou +55 35 98875-4197</PhoneText>
 *   <PhoneText text="..." />
 */
interface Props {
  children?: React.ReactNode;
  text?: string;
  contactName?: string;
}

export function PhoneText({ children, text, contactName }: Props) {
  const requestWavoipCall = useWebphoneStore((s) => s.requestWavoipCall);
  const tokens = useWebphoneStore((s) => s.wavoipTokens);
  const isDialing = useWebphoneStore((s) => s.isDialing);

  const raw = text ?? (typeof children === "string" ? children : "");

  function dial(phone: string) {
    const digits = normalize(phone);
    if (!digits) return;
    if (isDialing) {
      alert("Aguarde a chamada atual terminar.");
      return;
    }
    const ok = confirm(`Ligar para ${phone}?`);
    if (!ok) return;
    const firstToken = Object.values(tokens)[0]?.token;
    requestWavoipCall({
      phone: digits,
      token: firstToken,
      contactName,
    });
  }

  if (!raw) return <>{children}</>;

  // Quebra o texto em pedacos: texto normal | telefone clicavel
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const matches = raw.matchAll(PHONE_REGEX);
  let key = 0;

  for (const m of matches) {
    const phone = m[0];
    if (!isValidE164(phone)) continue;
    const start = m.index ?? 0;
    if (start > lastIndex) {
      parts.push(raw.slice(lastIndex, start));
    }
    parts.push(
      <button
        key={key++}
        type="button"
        onClick={() => dial(phone)}
        className="inline-flex items-center gap-1 text-wavoip-500 hover:underline disabled:opacity-50"
        title={`Ligar para ${phone}`}
        disabled={isDialing}
      >
        <Phone className="h-3 w-3" />
        {phone}
      </button>
    );
    lastIndex = start + phone.length;
  }

  if (lastIndex < raw.length) {
    parts.push(raw.slice(lastIndex));
  }

  if (parts.length === 0) return <>{children ?? raw}</>;

  return <>{parts}</>;
}
