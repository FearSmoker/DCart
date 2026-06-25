"use client";

import React from "react";

const SmallLoader = () => {
  return (
    <div className="w-16 h-[2px] bg-gray-200 dark:bg-zinc-800 relative overflow-hidden inline-block align-middle mx-2">
      <div className="absolute top-1/2 -translate-y-1/2 animate-dcartLoad">
        <svg className="w-3 h-3 text-lightOrange fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          {/* Speed lines */}
          <path d="M2 9h4M1 12h5M3 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          {/* Cart Basket */}
          <path d="M7 8h11l-2 7H9L7 8z" fill="currentColor" />
          {/* Wheels */}
          <circle cx="10.5" cy="18" r="1.7" fill="currentColor" />
          <circle cx="14.5" cy="18" r="1.7" fill="currentColor" />
        </svg>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 animate-dcartLoad" style={{ animationDelay: "-1s" }}>
        <svg className="w-3 h-3 text-lightOrange fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          {/* Speed lines */}
          <path d="M2 9h4M1 12h5M3 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          {/* Cart Basket */}
          <path d="M7 8h11l-2 7H9L7 8z" fill="currentColor" />
          {/* Wheels */}
          <circle cx="10.5" cy="18" r="1.7" fill="currentColor" />
          <circle cx="14.5" cy="18" r="1.7" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
};

export default SmallLoader;
