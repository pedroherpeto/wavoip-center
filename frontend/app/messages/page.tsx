"use client";

import { MessagesSection } from "@/components/sections/MessagesSection";

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Mensagens</h1>
      </div>
      <MessagesSection />
    </div>
  );
}
