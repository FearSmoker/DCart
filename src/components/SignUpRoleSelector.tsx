"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUpRoleSelector() {
  const [role, setRole] = useState<"consumer" | "seller">("consumer");
  const router = useRouter();

  const handleContinue = () => {
    router.push(`/signup?step=register&role=${role}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Consumer card choice */}
        <div
          onClick={() => setRole("consumer")}
          className={`flex flex-col items-center justify-center p-6 border rounded-[22px] cursor-pointer transition-all duration-300 ${
            role === "consumer"
              ? "border-accent bg-orange-50/20 dark:bg-zinc-800/30 shadow-[0_4px_20px_rgba(249,115,22,0.06)]"
              : "border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-gray-350 dark:hover:border-zinc-700 hover:bg-gray-50/50 dark:hover:bg-zinc-850/50"
          }`}
        >
          <span className="text-4xl mb-3">🛒</span>
          <span className="font-bold text-base text-accent dark:text-zinc-100">Consumer</span>
          <span className="text-[11px] text-lightText dark:text-zinc-400 mt-1 text-center leading-tight">
            Shop products &amp; track orders
          </span>
        </div>

        {/* Seller card choice */}
        <div
          onClick={() => setRole("seller")}
          className={`flex flex-col items-center justify-center p-6 border rounded-[22px] cursor-pointer transition-all duration-300 ${
            role === "seller"
              ? "border-accent bg-orange-50/20 dark:bg-zinc-800/30 shadow-[0_4px_20px_rgba(249,115,22,0.06)]"
              : "border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-gray-350 dark:hover:border-zinc-700 hover:bg-gray-50/50 dark:hover:bg-zinc-850/50"
          }`}
        >
          <span className="text-4xl mb-3">🏪</span>
          <span className="font-bold text-base text-accent dark:text-zinc-100">Seller</span>
          <span className="text-[11px] text-lightText dark:text-zinc-400 mt-1 text-center leading-tight">
            List products &amp; manage sales
          </span>
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="w-full py-3 px-4 bg-accent hover:bg-accent/90 dark:bg-zinc-100 dark:text-black dark:hover:bg-white text-white font-bold rounded-full transition-all duration-300 text-xs uppercase tracking-wider shadow-xs"
      >
        Continue as {role === "consumer" ? "Consumer" : "Seller"} →
      </button>
    </div>
  );
}
