import React from "react";
import Link from "next/link";
import { HiLockClosed } from "react-icons/hi";

interface AccessDeniedProps {
  message?: string;
  buttonText?: string;
  buttonHref?: string;
}

export default function AccessDenied({
  message = "You do not have the authority to access this page",
  buttonText = "Go back to homepage",
  buttonHref = "/",
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center bg-white dark:bg-zinc-900 transition-colors duration-300">
      <div className="relative mb-6">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-red-500/10 dark:bg-red-500/20 blur-xl rounded-full w-24 h-24 -translate-x-3 -translate-y-3" />
        
        {/* Shield Icon Container */}
        <div className="relative w-20 h-20 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center justify-center text-red-500 shadow-md">
          <HiLockClosed className="text-4xl" />
        </div>
      </div>
      
      <h1 className="text-2xl font-black text-accent dark:text-zinc-100 tracking-tight mb-2">
        Access Denied
      </h1>
      
      <p className="text-sm text-lightText dark:text-zinc-400 max-w-md mb-8 leading-relaxed font-semibold">
        {message}
      </p>
      
      <Link
        href={buttonHref}
        className="inline-flex items-center justify-center px-8 py-3.5 bg-lightOrange hover:bg-darkOrange text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-250 transform hover:-translate-y-0.5 text-xs uppercase tracking-wider"
      >
        {buttonText}
      </Link>
    </div>
  );
}