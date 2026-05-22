"use client";

import { CallbacksSection } from "@/components/sections/CallbacksSection";

export default function CallbacksPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Callbacks</h1>
      </div>
      <CallbacksSection />
    </div>
  );
}
