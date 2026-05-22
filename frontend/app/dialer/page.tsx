"use client";

import { useTranslations } from "next-intl";
import { Dialer } from "@/components/Dialer";

export default function DialerPage() {
  const t = useTranslations("dialer");
  return (
    <div className="flex flex-col gap-6 py-6">
      <h1 className="text-2xl font-semibold text-center">{t("title")}</h1>
      <Dialer />
    </div>
  );
}
