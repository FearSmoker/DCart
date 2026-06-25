import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Layout from "@/components/Layout";
import { Toaster } from "react-hot-toast";
import SideBar from "@/components/SideBar";
import ShoppingCopilot from "@/components/ShoppingCopilot";
import CustomerSupport from "@/components/CustomerSupport";
import ProductComparisonProvider from "@/components/ProductComparison";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "DCart",
  description: "DCart Online Shopping App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('dcart-theme');
                  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-zinc-900 text-black dark:text-zinc-100 transition-colors duration-300`}
      >
        <ProductComparisonProvider>
          <Layout>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-1 flex flex-col">{children}</main>
              <Footer />
            </div>
            <SideBar />
            <ShoppingCopilot />
            <CustomerSupport />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#000000",
                  color: "#FFFFFF",
                },
              }}
            />
          </Layout>
        </ProductComparisonProvider>
      </body>
    </html>
  );
}
