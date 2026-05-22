import { getRequestConfig } from "next-intl/server";

const SUPPORTED = ["pt-BR", "en-US"] as const;
type Locale = (typeof SUPPORTED)[number];

export default getRequestConfig(async () => {
  // Single-tenant: default to pt-BR. Header-based detection can be added later.
  const locale: Locale = "pt-BR";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
