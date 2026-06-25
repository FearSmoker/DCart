"use client";

import React from "react";
import { Provider } from "react-redux";
import { store } from "@/redux/store";
import { SessionProvider } from "next-auth/react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <SessionProvider>
      <Provider store={store}>{children}</Provider>
    </SessionProvider>
  );
};

export default Layout;