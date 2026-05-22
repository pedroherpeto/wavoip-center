"use client";

import { BusinessHoursSection } from "@/components/sections/BusinessHoursSection";

export default function BusinessHoursPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Horário comercial</h1>
      </div>
      <BusinessHoursSection />
    </div>
  );
}
