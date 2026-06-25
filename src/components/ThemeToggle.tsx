"use client";

import React, { useEffect, useState } from "react";
import { MdOutlineLightMode, MdOutlineDarkMode } from "react-icons/md";

const ThemeToggle = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // check initial theme from document class
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    if (theme === "light") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("dcart-theme", "dark");
      setTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("dcart-theme", "light");
      setTheme("light");
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl bg-gray-50 dark:bg-zinc-800 text-accent dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-700 hover:text-orange-500 transition-colors duration-200"
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
      aria-label={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {theme === "light" ? (
        <MdOutlineDarkMode className="text-xl" />
      ) : (
        <MdOutlineLightMode className="text-xl text-orange-400" />
      )}
    </button>
  );
};

export default ThemeToggle;
