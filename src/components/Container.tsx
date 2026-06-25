import React from "react";
import { twMerge } from "tailwind-merge";

interface Props {
  children: React.ReactNode;
  className?: string;
}

const Container = ({ children, className }: Props) => {
  return (
    <div className={twMerge("w-full px-4 sm:px-6 md:px-8", className)}>
      {children}
    </div>
  );
};

export default Container;
