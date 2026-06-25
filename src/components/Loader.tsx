"use client";

import React from "react";

const Loader = ({ title, className }: { title?: string; className?: string }) => {
  return (
    <div className={`w-full py-12 flex flex-col items-center justify-center ${className ?? ""}`}>
      <div className="w-full max-w-xs h-[2px] bg-gray-200 dark:bg-zinc-800 relative overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 animate-dcartLoad">
          <svg className="w-5 h-5 text-lightOrange fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 9h4M1 12h5M3 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7 8h11l-2 7H9L7 8z" fill="currentColor" />
            <circle cx="10.5" cy="18" r="1.7" fill="currentColor" />
            <circle cx="14.5" cy="18" r="1.7" fill="currentColor" />
          </svg>
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 animate-dcartLoad" style={{ animationDelay: "-1s" }}>
          <svg className="w-5 h-5 text-lightOrange fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 9h4M1 12h5M3 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7 8h11l-2 7H9L7 8z" fill="currentColor" />
            <circle cx="10.5" cy="18" r="1.7" fill="currentColor" />
            <circle cx="14.5" cy="18" r="1.7" fill="currentColor" />
          </svg>
        </div>
      </div>
      {title && (
        <p className="text-xs font-bold text-accent dark:text-zinc-400 mt-4 animate-pulse uppercase tracking-wider">
          {title}
        </p>
      )}
    </div>
  );
};

export default Loader;
