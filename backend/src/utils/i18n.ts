import { getSettingSync, ensureCacheLoaded } from "../pabx/settings";

type Locale = "pt-BR" | "en-US";

// Mensagens estaticas (nao expostas via /settings). Strings dinamicas
// editaveis pelo painel resolvem via getSettingSync() em messages dinamicas.
const staticMessages: Record<Locale, Record<string, string>> = {
  "pt-BR": {
    "call.missed.followup":
      "Vi que voce ligou e nao conseguimos atender. Pode falar agora por aqui ou prefere que retornemos a ligacao?",
    "ivr.welcome": "Ola! Para te atender melhor, escolha uma opcao:",
    "ivr.option": "{number} - {label}",
    "ivr.timeout":
      "Nao recebemos sua resposta. Por favor, envie sua mensagem que retornaremos em breve.",
    "ivr.invalid":
      "Opcao invalida. Por favor, responda com o numero da opcao desejada.",
    "ivr.transferred":
      "Obrigado! Estamos transferindo seu atendimento. Em breve um atendente entrara em contato.",
    "outside_hours":
      "Estamos fora do horario de atendimento. Nossa equipe retornara assim que possivel.",
    "callback.scheduled": "Perfeito! Vamos te ligar em breve.",
  },
  "en-US": {
    "call.missed.followup":
      "I saw you tried to call us. Can you chat now or would you prefer that we call you back?",
    "ivr.welcome": "Hello! To better assist you, please choose an option:",
    "ivr.option": "{number} - {label}",
    "ivr.timeout":
      "We didn't receive your response. Please send your message and we'll get back to you soon.",
    "ivr.invalid": "Invalid option. Please reply with the desired option number.",
    "ivr.transferred":
      "Thanks! We're transferring you to an agent. Someone will reach out shortly.",
    "outside_hours":
      "We're currently outside business hours. Our team will respond as soon as possible.",
    "callback.scheduled": "Got it! We'll call you shortly.",
  },
};

function dynamicMessage(key: string, locale: Locale): string | undefined {
  if (key === "call.reject.default") {
    return locale === "en-US"
      ? getSettingSync("call_reject_message_en")
      : getSettingSync("call_reject_message_pt");
  }
  return undefined;
}

export function t(
  key: string,
  locale: Locale = "pt-BR",
  vars?: Record<string, string | number>
): string {
  const dyn = dynamicMessage(key, locale);
  let str = dyn ?? staticMessages[locale]?.[key] ?? staticMessages["pt-BR"][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`{${k}}`, "g"), String(v));
    }
  }
  return str;
}

export function isValidLocale(locale: string): locale is Locale {
  return locale === "pt-BR" || locale === "en-US";
}

// Garantir cache de settings carregado antes do primeiro t() (chamado no boot)
export async function initI18n(): Promise<void> {
  await ensureCacheLoaded();
}
