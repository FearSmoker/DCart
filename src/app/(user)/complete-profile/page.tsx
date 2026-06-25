"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";
import Title from "@/components/Title";
import toast from "react-hot-toast";

export default function CompleteProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [role, setRole] = useState<"consumer" | "seller">("consumer");
  const [loading, setLoading] = useState(false);

  // redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    } else if (status === "authenticated" && session?.user) {
      const userRole = (session.user as Record<string, unknown>).role as string | undefined;
      if (userRole && userRole !== "onboarding") {
        router.push("/dashboard");
      }
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <Container className="py-20 text-center">
        <p className="text-lg text-slate-400 animate-pulse font-semibold">Loading profile...</p>
      </Container>
    );
  }

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const loadingToast = toast.loading("Saving your selection...");

    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Profile completed successfully!", { id: loadingToast });
        
        // refresh the session client-side to update...
        await update();
        
        // redirect to dashboard or home page
        router.push(role === "seller" ? "/" : "/dashboard");
      } else {
        toast.error(data.error || "Failed to update profile.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred. Please try again.", { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* glow effects */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
            <span className="text-orange-400 text-xs font-bold uppercase tracking-wider">Onboarding</span>
          </div>
          <Title className="text-3xl font-extrabold text-white tracking-tight">
            Complete your profile
          </Title>
          <p className="mt-2 text-sm text-slate-400">
            Tell us how you would like to use DCart. Choose your account type to proceed.
          </p>
        </div>

        <form className="mt-8 space-y-6 relative z-10" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Select Account Type
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* consumer option */}
              <div
                onClick={() => setRole("consumer")}
                className={`flex flex-col items-center justify-center p-6 border rounded-2xl cursor-pointer transition-all duration-300 ${
                  role === "consumer"
                    ? "border-orange-500 bg-orange-500/10 text-white shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <span className="text-4xl mb-3"></span>
                <span className="font-bold text-base">Consumer</span>
                <span className="text-[10px] text-slate-400 mt-1 text-center">
                  Shop real-time items & track orders
                </span>
              </div>

              {/* seller option */}
              <div
                onClick={() => setRole("seller")}
                className={`flex flex-col items-center justify-center p-6 border rounded-2xl cursor-pointer transition-all duration-300 ${
                  role === "seller"
                    ? "border-orange-500 bg-orange-500/10 text-white shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <span className="text-4xl mb-3"></span>
                <span className="font-bold text-base">Seller</span>
                <span className="text-[10px] text-slate-400 mt-1 text-center">
                  List products & review sales
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving Selection...
                </>
              ) : (
                "Save & Continue →"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
