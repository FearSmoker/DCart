"use client";

import React, { useState, useEffect } from "react";
import { MdMenu, MdClose } from "react-icons/md";
import Link from "next/link";
import { navBarList } from "@/constants";

interface MobileMenuButtonProps {
  isSeller?: boolean;
  isAdmin?: boolean;
}

export default function MobileMenuButton({ isSeller = false, isAdmin = false }: MobileMenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen((prev) => !prev);
    window.addEventListener("toggle-sidebar-mobile", handler);
    return () => window.removeEventListener("toggle-sidebar-mobile", handler);
  }, []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <>
      {/* Toggle button */}
      <button
        className="inline-flex md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? (
          <MdClose className="text-2xl text-accent dark:text-zinc-100" />
        ) : (
          <MdMenu className="text-2xl text-accent dark:text-zinc-100" />
        )}
      </button>

      {/* Menu overlay drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-20 left-0 right-0 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-xl z-50 md:hidden animate-slideDown">
            <nav className="flex flex-col p-4 gap-1">
              {navBarList
                .filter((item) => !(isSeller && item.link === "/cart"))
                .map((item) => (
                  <Link
                    key={item.link}
                    href={item.link}
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-3 text-sm font-semibold text-accent dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-darkOrange dark:hover:text-lightOrange rounded-xl transition-colors"
                  >
                    {item.title}
                  </Link>
                ))}
              <div className="border-t border-gray-100 dark:border-zinc-800 my-2" />
              {!isSeller && (
                <Link
                  href="/wishlist"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-3 text-sm font-semibold text-accent dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-darkOrange dark:hover:text-lightOrange rounded-xl transition-colors flex items-center gap-2"
                >
                  Wishlist
                </Link>
              )}
              {!isSeller && (
                <Link
                  href="/orders"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-3 text-sm font-semibold text-accent dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-darkOrange dark:hover:text-lightOrange rounded-xl transition-colors"
                >
                  My Orders
                </Link>
              )}
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="px-4 py-3 text-sm font-semibold text-accent dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-darkOrange dark:hover:text-lightOrange rounded-xl transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/visual-search"
                onClick={() => setIsOpen(false)}
                className="px-4 py-3 text-sm font-semibold text-accent dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-darkOrange dark:hover:text-lightOrange rounded-xl transition-colors"
              >
                Visual Search
              </Link>
              {isAdmin && (
                <>
                  <div className="border-t border-gray-100 dark:border-zinc-800 my-2" />
                  <Link
                    href="/studio/security"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-3 text-sm font-semibold text-accent dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-darkOrange dark:hover:text-lightOrange rounded-xl transition-colors flex items-center gap-2"
                  >
                    Security 🔒
                  </Link>
                  <Link
                    href="/studio"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-3 text-sm font-semibold text-accent dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-darkOrange dark:hover:text-lightOrange rounded-xl transition-colors flex items-center gap-2"
                  >
                    Admin Studio
                  </Link>
                </>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
