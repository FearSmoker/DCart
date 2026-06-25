"use client";
import SignOut from "@/components/SignOut";
import Title from "@/components/Title";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import AdminAnalytics from "@/components/AdminAnalytics";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import Loader from "@/components/Loader";


// ─── types ──────────────────────────────────────────────────────────────────
interface VendorApplication {
  id: string;
  name: string;
  email: string;
  store_name: string;
  primary_category: string;
  status: string;
  approved: boolean;
  commission_rate: number;
  created_at: string;
}

interface PendingPayout {
  orderId: string;
  email: string;
  vendorId: string;
  storeName: string;
  amount: number;
  netAmount: number;
  commissionRate: number;
  deliveredAt: string;
  items: Array<{ title?: string; quantity?: number; price?: number; _id?: string }>;
}

// ─── payouts panel ────────────────────────────────────────────────────────────
const PayoutsPanel = () => {
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payouts");
      const data = await res.json();
      if (data.success) setPayouts(data.payouts || []);
    } catch (err) {
      console.error("Failed to load payouts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  // Live real-time updates — auto-refresh when relevant events fire
  const { connected } = useRealtime({
    "order:delivered": () => {
      // A new order was delivered — could be a new payout to approve
      fetchPayouts();
    },
    "payout:approved": () => {
      // Admin approved a payout (possibly from another session) — refresh list
      fetchPayouts();
    },
    "payout:rejected": () => {
      fetchPayouts();
    },
  });

  const handleAction = async (payout: PendingPayout, action: "approve" | "reject") => {
    setActionLoading(payout.orderId);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: payout.orderId,
          email: payout.email,
          vendorId: payout.vendorId,
          action,
          netAmount: payout.netAmount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          action === "approve"
            ? `✅ Payout of $${payout.netAmount.toFixed(2)} approved for ${payout.storeName}`
            : `❌ Payout rejected for ${payout.storeName}`,
          action === "approve"
        );
        await fetchPayouts();
      } else {
        showToast(data.error || "Action failed", false);
      }
    } catch (err) {
      console.error(err);
      showToast("An error occurred", false);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-bold animate-in slide-in-from-top-2 duration-300 ${
            toast.ok ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-accent dark:text-zinc-100">Seller Payout Approvals</h2>
          <p className="text-xs text-lightText dark:text-zinc-400 mt-0.5">
            Review and approve earnings for sellers whose orders have been delivered.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${
            connected
              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
              : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
            {connected ? "Live" : "Offline"}
          </span>
          <button
            onClick={fetchPayouts}
            className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Pending Approvals",
            value: payouts.length,
            color: "bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/50 text-amber-705 dark:text-amber-400",
          },
          {
            label: "Total Pending Value",
            value: `$${payouts.reduce((s, p) => s + p.netAmount, 0).toFixed(2)}`,
            color: "bg-blue-50 dark:bg-blue-950/20 border-blue-250 dark:border-blue-900/50 text-blue-705 dark:text-blue-400",
          },
          {
            label: "Vendors Awaiting",
            value: new Set(payouts.map((p) => p.vendorId)).size,
            color: "bg-purple-50 dark:bg-purple-950/20 border-purple-255 dark:border-purple-900/50 text-purple-705 dark:text-purple-400",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className={`border rounded-xl p-4 text-center ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-semibold mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* payouts table */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50 dark:from-zinc-850 dark:to-zinc-850">
          <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Pending Payout Queue</h3>
          <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-705 dark:text-amber-400 px-2.5 py-1 rounded-full">
            {payouts.length} awaiting approval
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-850 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-14 text-lightText dark:text-zinc-400">
            <span className="text-5xl block mb-3">🎉</span>
            <p className="font-bold text-sm text-accent dark:text-zinc-100">All payouts processed!</p>
            <p className="text-xs mt-1">No pending payout approvals. Check back after orders are delivered.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-lightText dark:text-zinc-400">
                  <th className="px-5 py-3">Seller / Store</th>
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Gross</th>
                  <th className="px-5 py-3">Commission</th>
                  <th className="px-5 py-3">Net Payout</th>
                  <th className="px-5 py-3">Delivered</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {payouts.map((payout) => (
                  <tr key={payout.orderId} className="text-xs hover:bg-gray-50 dark:hover:bg-zinc-850/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-accent dark:text-zinc-100">{payout.storeName}</p>
                      <p className="text-[10px] text-lightText dark:text-zinc-400">{payout.vendorId.slice(0, 8)}…</p>
                    </td>
                    <td className="px-5 py-4 font-mono text-accent dark:text-zinc-200 font-semibold">
                      {payout.orderId.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-5 py-4 text-lightText dark:text-zinc-400">{payout.email}</td>
                    <td className="px-5 py-4">
                      <div className="space-y-0.5 max-w-[160px]">
                        {payout.items.slice(0, 2).map((item, idx) => (
                          <p key={idx} className="text-[10px] text-lightText dark:text-zinc-400 truncate">
                            {item.title} ×{item.quantity}
                          </p>
                        ))}
                        {payout.items.length > 2 && (
                          <p className="text-[10px] text-lightText/60 dark:text-zinc-500">
                            +{payout.items.length - 2} more
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-accent dark:text-zinc-100">
                      ${payout.amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-red-500 dark:text-red-400 font-semibold">
                      -{Math.round(payout.commissionRate * 100)}%
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ${payout.netAmount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-lightText dark:text-zinc-400">
                      {payout.deliveredAt
                        ? new Date(payout.deliveredAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(payout, "approve")}
                          disabled={actionLoading === payout.orderId}
                          className="px-3 py-1.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-all text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading === payout.orderId ? "…" : "✓ Approve"}
                        </button>
                        <button
                          onClick={() => handleAction(payout, "reject")}
                          disabled={actionLoading === payout.orderId}
                          className="px-3 py-1.5 bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 font-bold rounded-lg hover:bg-red-200 dark:hover:bg-red-900 transition-all text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading === payout.orderId ? "…" : "✕ Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Seller Applications Panel ────────────────────────────────────────────────
const SellerApplicationsPanel = () => {
  const [vendors, setVendors] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/register");
      const data = await res.json();
      if (data.success) {
        setVendors(data.vendors || []);
      }
    } catch (err) {
      console.error("Failed to load vendor applications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleAction = async (vendorId: string, action: "approve" | "reject") => {
    setActionLoading(vendorId);
    try {
      const res = await fetch("/api/vendor/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, action }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchVendors();
      }
    } catch (err) {
      console.error("Failed to update vendor status:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const [pagePending, setPagePending] = useState(1);
  const [pageProcessed, setPageProcessed] = useState(1);

  const pending = vendors.filter((v) => v.status === "pending");
  const processed = vendors.filter((v) => v.status !== "pending");

  const limitPending = 5;
  const totalPagesPending = Math.ceil(pending.length / limitPending);
  const activePagePending = Math.max(1, Math.min(pagePending, totalPagesPending));
  const paginatedPending = pending.slice((activePagePending - 1) * limitPending, activePagePending * limitPending);

  const limitProcessed = 5;
  const totalPagesProcessed = Math.ceil(processed.length / limitProcessed);
  const activePageProcessed = Math.max(1, Math.min(pageProcessed, totalPagesProcessed));
  const paginatedProcessed = processed.slice((activePageProcessed - 1) * limitProcessed, activePageProcessed * limitProcessed);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending Review", value: pending.length, color: "bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/50 text-amber-705 dark:text-amber-400" },
          { label: "Approved Sellers", value: vendors.filter((v) => v.approved).length, color: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/50 text-emerald-705 dark:text-emerald-400" },
          { label: "Total Applications", value: vendors.length, color: "bg-blue-50 dark:bg-blue-950/20 border-blue-250 dark:border-blue-900/50 text-blue-705 dark:text-blue-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`border rounded-xl p-4 text-center ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-semibold mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Pending Applications */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Pending Seller Applications</h3>
            <p className="text-xs text-lightText dark:text-zinc-400 mt-0.5">Review and approve or reject seller registrations</p>
          </div>
          <button
            onClick={fetchVendors}
            className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-350 text-xs font-bold rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-850 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center py-10 text-lightText dark:text-zinc-400">
            <span className="text-4xl block mb-3">✅</span>
            <p className="font-semibold text-sm">No pending applications</p>
            <p className="text-xs mt-1">All seller applications have been processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-lightText dark:text-zinc-400">
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Store</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Commission</th>
                  <th className="px-5 py-3">Applied</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {paginatedPending.map((vendor) => (
                  <tr key={vendor.id} className="text-xs hover:bg-gray-50 dark:hover:bg-zinc-850/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-accent dark:text-zinc-100">{vendor.name}</p>
                      <p className="text-[10px] text-lightText dark:text-zinc-400">{vendor.email}</p>
                    </td>
                    <td className="px-5 py-3 font-medium text-accent dark:text-zinc-200">{vendor.store_name}</td>
                    <td className="px-5 py-3 text-lightText dark:text-zinc-400">{vendor.primary_category}</td>
                    <td className="px-5 py-3 font-bold text-darkOrange dark:text-lightOrange">
                      {Math.round(vendor.commission_rate * 100)}%
                    </td>
                    <td className="px-5 py-3 text-lightText dark:text-zinc-400">
                      {new Date(vendor.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(vendor.id, "approve")}
                          disabled={actionLoading === vendor.id}
                          className="px-3 py-1 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-all text-[10px] disabled:opacity-50"
                        >
                          {actionLoading === vendor.id ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleAction(vendor.id, "reject")}
                          disabled={actionLoading === vendor.id}
                          className="px-3 py-1 bg-red-100 dark:bg-red-950/20 text-red-655 dark:text-red-400 font-bold rounded-lg hover:bg-red-200 dark:hover:bg-red-900 transition-all text-[10px] disabled:opacity-50"
                        >
                          {actionLoading === vendor.id ? "…" : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPagesPending > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-50 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPagePending((prev) => Math.max(1, prev - 1))}
                  disabled={activePagePending <= 1}
                  className={`px-3 py-1.5 border rounded-lg font-bold text-[10px] transition-all ${
                    activePagePending <= 1
                      ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-650"
                      : "border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-850 text-accent dark:text-zinc-200"
                  }`}
                >
                  ← Prev
                </button>
                <span className="text-[10px] font-bold text-accent dark:text-zinc-200">
                  Page {activePagePending} of {totalPagesPending}
                </span>
                <button
                  type="button"
                  onClick={() => setPagePending((prev) => Math.min(totalPagesPending, prev + 1))}
                  disabled={activePagePending >= totalPagesPending}
                  className={`px-3 py-1.5 border rounded-lg font-bold text-[10px] transition-all ${
                    activePagePending >= totalPagesPending
                      ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-650"
                      : "border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-850 text-accent dark:text-zinc-200"
                  }`}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Processed Applications */}
      {processed.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xs">
          <div className="p-5 border-b border-gray-50 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Processed Applications</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-lightText dark:text-zinc-400">
                  <th className="px-5 py-3">Store</th>
                  <th className="px-5 py-3">Seller</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {paginatedProcessed.map((vendor) => (
                  <tr key={vendor.id} className="text-xs">
                    <td className="px-5 py-3 font-semibold text-accent dark:text-zinc-200">{vendor.store_name}</td>
                    <td className="px-5 py-3 text-lightText dark:text-zinc-400">{vendor.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          vendor.approved
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450"
                            : "bg-red-50 dark:bg-red-950/20 text-red-655 dark:text-red-400"
                        }`}
                      >
                        {vendor.approved ? "Approved" : "Rejected"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPagesProcessed > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-50 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPageProcessed((prev) => Math.max(1, prev - 1))}
                  disabled={activePageProcessed <= 1}
                  className={`px-3 py-1.5 border rounded-lg font-bold text-[10px] transition-all ${
                    activePageProcessed <= 1
                      ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-655"
                      : "border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-850 text-accent dark:text-zinc-200"
                  }`}
                >
                  ← Prev
                </button>
                <span className="text-[10px] font-bold text-accent dark:text-zinc-200">
                  Page {activePageProcessed} of {totalPagesProcessed}
                </span>
                <button
                  type="button"
                  onClick={() => setPageProcessed((prev) => Math.min(totalPagesProcessed, prev + 1))}
                  disabled={activePageProcessed >= totalPagesProcessed}
                  className={`px-3 py-1.5 border rounded-lg font-bold text-[10px] transition-all ${
                    activePageProcessed >= totalPagesProcessed
                      ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-655"
                      : "border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-850 text-accent dark:text-zinc-200"
                  }`}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
const DashboardPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"analytics" | "sellers" | "payouts">("analytics");
  const isSeller = session?.user && (session.user as { role?: string }).role === "seller";

  const [usersData, setUsersData] = useState<{
    consumers: Array<{ name: string; email: string }>;
    sellers: Array<{ name: string; email: string; storeName?: string; status?: string }>;
    totalConsumers: number;
    totalSellers: number;
  } | null>(null);

  const [activeModal, setActiveModal] = useState<"consumers" | "sellers" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalPage, setModalPage] = useState(1);

  useEffect(() => {
    setModalPage(1);
  }, [activeModal, searchQuery]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsersData(data);
      }
    } catch (err) {
      console.error("Failed to load user lists:", err);
    }
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Trigger auto-deliver check on mount so orders get marked delivered in real-time
  useEffect(() => {
    fetch("/api/cron/auto-deliver").catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/signin");
      return;
    }

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/profile");
        const data = await res.json();
        if (data.success && data.user) {
          const freshRole = data.user.role;
          const freshEmail = data.user.email;
          const isUserAdmin = freshRole === "admin" ||
                              freshEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
                              freshEmail === process.env.ADMIN_EMAIL;
          
          setIsAdmin(isUserAdmin);
          setCheckingAuth(false);
          if (isUserAdmin) {
            fetchUsers();
          }
        } else {
          router.push("/signin");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/signin");
      }
    }

    checkAuth();
  }, [session, status, router, fetchUsers]);

  useRealtime({
    "analytics:updated": () => {
      if (isAdmin) {
        fetchUsers();
      }
    },
    "order:delivered": () => {
      // When any order is delivered, refresh the payouts panel if we're on that tab
      // (PayoutsPanel handles its own refresh via its own useRealtime or re-render)
    },
    "payout:approved": () => {
      // No-op for admin — PayoutsPanel handles its own fetch
    },
  });

  if (status === "loading" || checkingAuth) {
    return (
      <div className="w-full px-4 sm:px-6 md:px-8 py-10 min-h-[75vh] flex flex-col justify-start">
        <Loader title="Loading your dashboard..." />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="w-full px-4 sm:px-6 md:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
        <div className="flex items-center gap-4">
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt="Profile picture"
              width={80}
              height={80}
              className="w-14 h-14 rounded-full border border-gray-200"
            />
          )}
          <div>
            <Title className="text-xl md:text-2xl font-bold">
              Welcome back, {session?.user?.name}!
            </Title>
            <p className="text-xs text-lightText">{session?.user?.email}</p>
            {isAdmin && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-lightOrange/10 text-lightOrange px-2 py-0.5 rounded-full border border-lightOrange/20">
                Administrator
              </span>
            )}
          </div>
        </div>
        <SignOut />
      </div>

      {/* Admin View */}
      {isAdmin ? (
        <div>
          {/* Admin Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div
              onClick={() => {
                setActiveModal("consumers");
                setSearchQuery("");
              }}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/50 dark:border-blue-900/50 hover:border-blue-400 rounded-2xl p-5 shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Total Consumers</span>
                <span className="text-xl group-hover:scale-110 transition-transform">👥</span>
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-zinc-150">{usersData?.totalConsumers ?? 0}</h3>
              <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold mt-1.5 uppercase tracking-wider">
                Click to view consumer roster &rarr;
              </p>
            </div>

            <div
              onClick={() => {
                setActiveModal("sellers");
                setSearchQuery("");
              }}
              className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-900/50 hover:border-amber-400 rounded-2xl p-5 shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">Total Sellers</span>
                <span className="text-xl group-hover:scale-110 transition-transform">🏪</span>
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-zinc-150">{usersData?.totalSellers ?? 0}</h3>
              <p className="text-[10px] text-orange-500 dark:text-orange-400 font-bold mt-1.5 uppercase tracking-wider">
                Click to view seller roster &rarr;
              </p>
            </div>
          </div>

          {/* Admin tabs */}
          <div className="flex bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-1 gap-1 w-fit shadow-xs mb-6 flex-wrap">
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${
                activeTab === "analytics"
                  ? "bg-accent text-white dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-lightText dark:text-zinc-400 hover:text-accent dark:hover:text-zinc-200"
              }`}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => setActiveTab("sellers")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${
                activeTab === "sellers"
                  ? "bg-accent text-white dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-lightText dark:text-zinc-400 hover:text-accent dark:hover:text-zinc-200"
              }`}
            >
              🏪 Sellers
            </button>
            <button
              onClick={() => setActiveTab("payouts")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${
                activeTab === "payouts"
                  ? "bg-emerald-600 text-white dark:bg-emerald-950 dark:text-emerald-450"
                  : "text-lightText dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-450"
              }`}
            >
              💰 Payouts
            </button>

          </div>

          {activeTab === "analytics" && (
            <div>
              <div className="border-l-4 border-lightOrange pl-4 mb-6">
                <h2 className="text-lg font-bold text-accent dark:text-zinc-100">Business Intelligence &amp; Analytics</h2>
                <p className="text-xs text-lightText dark:text-zinc-400">
                  Real-time platform metrics aggregated from all transaction events and customer activities.
                </p>
              </div>
              <AdminAnalytics />
            </div>
          )}

          {activeTab === "sellers" && (
            <div>
              <div className="border-l-4 border-lightOrange pl-4 mb-6">
                <h2 className="text-lg font-bold text-accent dark:text-zinc-100">Seller Management</h2>
                <p className="text-xs text-lightText dark:text-zinc-400">
                  Review and manage seller applications. Approved sellers gain access to list products on DCart.
                </p>
              </div>
              <SellerApplicationsPanel />
            </div>
          )}

          {activeTab === "payouts" && (
            <div>
              <div className="border-l-4 border-emerald-500 pl-4 mb-6">
                <h2 className="text-lg font-bold text-accent dark:text-zinc-100">Payout Management</h2>
                <p className="text-xs text-lightText dark:text-zinc-400">
                  Review and approve seller earnings after order delivery. Commission is automatically deducted before payout.
                </p>
              </div>
              <PayoutsPanel />
            </div>
          )}
        </div>
      ) : (
        /* Regular user view */
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-lightOrange/5 to-darkOrange/5 dark:from-lightOrange/10 dark:to-darkOrange/10 border border-lightOrange/20 dark:border-lightOrange/30 rounded-2xl p-6">
            <h2 className="text-base font-bold text-accent dark:text-zinc-100 mb-1">Your Account</h2>
            <p className="text-sm text-lightText dark:text-zinc-400">
              Manage your orders, wishlist, and account preferences from here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/profile"
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all group"
            >
              <span className="text-3xl block mb-3">👤</span>
              <h3 className="font-bold text-accent dark:text-zinc-150 group-hover:text-darkOrange dark:group-hover:text-lightOrange transition-colors">My Account</h3>
              <p className="text-xs text-lightText dark:text-zinc-400 mt-1">
                {isSeller ? "Edit profile details & passwords" : "Edit profile details, passwords & addresses"}
              </p>
            </Link>

            {!isSeller && (
              <Link
                href="/orders"
                className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all group"
              >
                <span className="text-3xl block mb-3">📦</span>
                <h3 className="font-bold text-accent dark:text-zinc-150 group-hover:text-darkOrange dark:group-hover:text-lightOrange transition-colors">My Orders</h3>
                <p className="text-xs text-lightText dark:text-zinc-400 mt-1">Track and manage your purchases</p>
              </Link>
            )}

            {!isSeller && (
              <Link
                href="/wishlist"
                className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all group"
              >
                <span className="text-3xl block mb-3">❤️</span>
                <h3 className="font-bold text-accent dark:text-zinc-150 group-hover:text-darkOrange dark:group-hover:text-lightOrange transition-colors">My Wishlist</h3>
                <p className="text-xs text-lightText dark:text-zinc-400 mt-1">View your saved products</p>
              </Link>
            )}

            <Link
              href="/shop"
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all group"
            >
              <span className="text-3xl block mb-3">🛍️</span>
              <h3 className="font-bold text-accent dark:text-zinc-150 group-hover:text-darkOrange dark:group-hover:text-lightOrange transition-colors">Browse Products</h3>
              <p className="text-xs text-lightText dark:text-zinc-400 mt-1">Discover our full catalog</p>
            </Link>

            <Link
              href="/visual-search"
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all group"
            >
              <span className="text-3xl block mb-3">🔍</span>
              <h3 className="font-bold text-accent dark:text-zinc-150 group-hover:text-darkOrange dark:group-hover:text-lightOrange transition-colors">Visual Search</h3>
              <p className="text-xs text-lightText dark:text-zinc-400 mt-1">Find products by image</p>
            </Link>

            {!isSeller && (
              <Link
                href="/cart"
                className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all group"
              >
                <span className="text-3xl block mb-3">🛒</span>
                <h3 className="font-bold text-accent dark:text-zinc-150 group-hover:text-darkOrange dark:group-hover:text-lightOrange transition-colors">My Cart</h3>
                <p className="text-xs text-lightText dark:text-zinc-400 mt-1">Review your cart items</p>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* User Roster Modal via shadcn/ui Dialog */}
      <Dialog open={!!activeModal} onOpenChange={(open) => { if (!open) setActiveModal(null); }}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl gap-0 shadow-2xl">
          {/* Modal Header */}
          <DialogHeader className="p-6 border-b border-gray-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50">
            <DialogTitle className="text-lg font-bold text-accent dark:text-zinc-100 capitalize">
              {activeModal} Roster
            </DialogTitle>
            <DialogDescription className="text-xs text-lightText dark:text-zinc-400 mt-0.5">
              Showing all registered platform {activeModal === "consumers" ? "consumers" : "sellers"}
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="p-4 border-b border-gray-50 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeModal} by name or email...`}
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-250 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-accent dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>

          {/* List Scroll Area */}
          <ScrollArea className="h-[280px] p-4 bg-white dark:bg-zinc-900">
            {(() => {
              const list = activeModal === "consumers" ? usersData?.consumers : usersData?.sellers;
              const filtered = list?.filter(
                (u) =>
                  u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  u.email.toLowerCase().includes(searchQuery.toLowerCase())
              );

              if (!filtered || filtered.length === 0) {
                return (
                  <div className="text-center py-10 text-lightText dark:text-zinc-400 italic text-xs">
                    No matching {activeModal} found.
                  </div>
                );
              }

              const itemsPerPage = 6;
              const totalPages = Math.ceil(filtered.length / itemsPerPage);
              const activePage = Math.max(1, Math.min(modalPage, totalPages));
              const paginated = filtered.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

              return (
                <div className="space-y-2.5 pr-3">
                  {paginated.map((u, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-slate-50 dark:bg-zinc-850 hover:bg-slate-100/70 dark:hover:bg-zinc-800 p-3 rounded-xl border border-slate-100 dark:border-zinc-855 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-bold text-accent dark:text-zinc-200">{u.name}</p>
                        <p className="text-[10px] text-lightText dark:text-zinc-400 font-medium mt-0.5">{u.email}</p>
                      </div>
                      {activeModal === "sellers" && (
                        <span className="text-[9px] uppercase font-extrabold tracking-wider bg-orange-100/60 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-200/30 dark:border-orange-900/30">
                          Seller
                        </span>
                      )}
                    </div>
                  ))}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-50 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setModalPage((prev) => Math.max(1, prev - 1))}
                        disabled={activePage <= 1}
                        className={`px-3 py-1.5 border rounded-lg font-bold text-[10px] transition-all ${
                          activePage <= 1
                            ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-zinc-800 text-gray-400"
                            : "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-accent dark:text-zinc-200"
                        }`}
                      >
                        ← Prev
                      </button>
                      <span className="text-[10px] font-bold text-accent dark:text-zinc-200">
                        Page {activePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={activePage >= totalPages}
                        className={`px-3 py-1.5 border rounded-lg font-bold text-[10px] transition-all ${
                          activePage >= totalPages
                            ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-zinc-800 text-gray-400"
                            : "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-accent dark:text-zinc-200"
                        }`}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </ScrollArea>

          {/* Modal Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 text-right flex justify-end">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-350 dark:hover:bg-zinc-700 text-slate-750 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
