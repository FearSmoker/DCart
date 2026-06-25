import Link from "next/link";
import React from "react";
import Image from "next/image";
import logoLight from "@/assets/logo_light.png";
import logoDark from "@/assets/logo_dark.png";
import { twMerge } from "tailwind-merge";

const Logo = ({ className }: { className?: string }) => {
  const isWhiteText = className?.includes("text-white");
  return (
    <Link href={"/"} className={twMerge("flex items-center select-none", className)}>
      <Image
        src={logoLight}
        alt="DCart Logo"
        priority
        className={twMerge("h-8 sm:h-10 w-auto object-contain", isWhiteText ? "hidden" : "dark:hidden")}
      />
      <Image
        src={logoDark}
        alt="DCart Logo"
        priority
        className={twMerge("h-8 sm:h-10 w-auto object-contain", isWhiteText ? "block" : "hidden dark:block")}
      />
    </Link>
  );
};

export default Logo;
