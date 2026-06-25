import React from "react";
import Container from "@/components/Container";

export default function Loading() {
  return (
    <div className="w-full flex-1 flex flex-col min-h-[75vh]">
      {/* Top linear progress loading bar */}
      <div className="w-full h-1 bg-gray-150 dark:bg-zinc-800 overflow-hidden relative shrink-0">
        <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-lightOrange via-darkOrange to-lightOrange w-1/3 rounded-full animate-progressLinear" />
      </div>
      
      {/* Dimension-preserving skeleton placeholder */}
      <Container className="py-10 flex-1 flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        <div className="space-y-4">
          <div className="h-12 bg-gray-100 dark:bg-zinc-850 rounded-2xl" />
          <div className="h-64 bg-gray-100 dark:bg-zinc-850 rounded-2xl" />
        </div>
      </Container>
    </div>
  );
}
