"use client";

import {
  Youtube,
  Linkedin,
  Instagram,
  Github,
  MessageCircle,
  BookOpen,
  Headphones,
  ExternalLink,
} from "lucide-react";

const WAVOIP_SITE = "https://wavoip.com";
const WHATSAPP_COMMUNITY = "https://chat.whatsapp.com/I01kn65n3CqKFvRIIvQ6hM";

const LINKS = {
  recursos: [
    { label: "Comunidade WhatsApp", href: WHATSAPP_COMMUNITY, icon: MessageCircle },
    { label: "Materiais", href: `${WAVOIP_SITE}/materiais` },
    {
      label: "Documentação",
      href: `${WAVOIP_SITE}/docs`,
      icon: BookOpen,
    },
    { label: "Tutoriais (YouTube)", href: "https://www.youtube.com/@wavoip" },
  ],
  redes: [
    { label: "YouTube", href: "https://www.youtube.com/@wavoip", icon: Youtube },
    { label: "LinkedIn", href: "https://linkedin.com/company/wavoip", icon: Linkedin },
    { label: "Instagram", href: "https://instagram.com/wavoip", icon: Instagram },
    { label: "Grupo WhatsApp", href: WHATSAPP_COMMUNITY, icon: MessageCircle },
    { label: "Suporte WhatsApp", href: WHATSAPP_COMMUNITY, icon: Headphones },
    { label: "GitHub", href: "https://github.com/wavoip", icon: Github },
  ],
};

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--card)]/40 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        {/* Top: brand + colunas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex flex-col gap-2 md:col-span-1">
            <a
              href={WAVOIP_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 group"
            >
              <img
                src="/wavoip.png"
                alt="Wavoip"
                className="h-8 w-8 rounded-lg object-contain"
              />
              <span className="font-semibold group-hover:text-wavoip-500 transition-colors">
                Wavoip
              </span>
            </a>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              PABX completo sobre WhatsApp com voz, IVR, NPS e resumo IA.
            </p>
            <a
              href={WAVOIP_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-wavoip-500 hover:underline inline-flex items-center gap-1 mt-1"
            >
              wavoip.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-3">
              Recursos
            </h3>
            <ul className="flex flex-col gap-2">
              {LINKS.recursos.map((l) => {
                const Icon = (l as any).icon;
                return (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--muted-foreground)] hover:text-wavoip-500 inline-flex items-center gap-1.5 transition-colors"
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {l.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-3">
              Redes & Suporte
            </h3>
            <ul className="flex flex-col gap-2">
              {LINKS.redes.map((l) => {
                const Icon = l.icon;
                return (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--muted-foreground)] hover:text-wavoip-500 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {l.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
              Precisa de suporte?
            </h3>
            <a
              href={WHATSAPP_COMMUNITY}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-wavoip-500 text-black hover:bg-wavoip-400 transition-colors px-4 py-2 text-sm font-medium"
            >
              <MessageCircle className="h-4 w-4" />
              Fale Conosco →
            </a>
            <div className="mt-3 flex flex-col gap-1">
              <a
                href={`${WAVOIP_SITE}/politica-de-privacidade`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--muted-foreground)] hover:text-wavoip-500"
              >
                Política de Privacidade
              </a>
              <a
                href={`${WAVOIP_SITE}/termos`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--muted-foreground)] hover:text-wavoip-500"
              >
                Termos & Condições
              </a>
            </div>
          </div>
        </div>

        {/* Bottom: copyright + CNPJ */}
        <div className="mt-8 pt-6 border-t border-[var(--border)] flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[10px] text-[var(--muted-foreground)]">
          <span>© Wavoip 2026. All rights reserved.</span>
          <span>Wavoip Telecomunicações LTDA · 45.507.748/0001-13</span>
        </div>
      </div>
    </footer>
  );
}
