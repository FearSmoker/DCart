"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import FormattedPrice from "@/components/FormattedPrice";
import Loader from "@/components/Loader";
import AccessDenied from "@/components/AccessDenied";
import Container from "@/components/Container";


// ─── types ─────────────────────────────────────────────────────────────────
interface MonthlyChart {
  labels: string[];
  revenue: number[];
  orders: number[];
  cancelled?: number[];
}

interface DashboardData {
  vendor_id: string;
  total_orders: number;
  total_revenue: number;
  platform_commission: number;
  vendor_earnings: number;        // potential: all orders net of commission
  confirmed_earnings: number;     // confirmed: delivered orders net of commission
  pending_payout: number;
  total_paid_out: number;
  commission_rate: number;
  avg_order_value: number;
  cancelled_revenue?: number;
  monthly_chart: MonthlyChart;
  profile?: {
    store_name?: string;
    status?: string;
    approved?: boolean;
    primary_category?: string;
  };
}

interface ProductVariant {
  color: string;
  model?: string;
  images: string[];
  price: number;
  quantity: number;
}

interface VendorProduct {
  _id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  type: string;
  quantity: number;
  createdAt: string;
  variants?: ProductVariant[];
  slug?: string;
}

interface OrderItem {
  _id: string;
  title: string;
  quantity: number;
  price: number;
}

interface VendorOrder {
  id: string;
  email: string;
  value: {
    amount: number;
    items: OrderItem[];
    status?: string;
  };
}

// ─── mini line sparkline ─────────────────────────────────────────────────────
const Sparkline = ({ data, color = "#f97316" }: { data: number[]; color?: string }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 120;
  const H = 40;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - ((v - min) / range) * (H - 8) - 4;
        return <circle key={i} cx={x} cy={y} r="2" fill={color} />;
      })}
    </svg>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, sub, icon, color, sparkData
}: {
  label: string; value: string; sub?: string; icon: string;
  color: string; sparkData?: number[];
}) => (
  <div className={`bg-gradient-to-br ${color} dark:from-zinc-900 dark:to-zinc-950 border border-white/50 dark:border-zinc-800 rounded-2xl p-5 shadow-sm`}>
    <div className="flex items-start justify-between mb-3">
      <span className="text-2xl">{icon}</span>
      {sparkData && <Sparkline data={sparkData} />}
    </div>
    <p className="text-2xl font-bold text-accent dark:text-zinc-100">{value}</p>
    <p className="text-xs font-semibold text-lightText dark:text-zinc-400 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-lightText/70 dark:text-zinc-500 mt-0.5">{sub}</p>}
  </div>
);

// ─── Profit Chart ───────────────────────────────────────────────────────────
const ProfitChart = ({ chart, commissionRate }: { chart: MonthlyChart; commissionRate: number }) => {
  const profits = chart.revenue.map((rev) => rev * (1 - commissionRate));
  const cancelledVals = (chart.cancelled || []).map((rev) => rev * (1 - commissionRate));
  const maxVal = Math.max(...profits, ...cancelledVals, 1);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Monthly Net Profit vs. Cancelled</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" />
            <span className="text-[10px] text-lightText dark:text-zinc-400 font-medium">Net Profit</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-gray-400 rounded-xs" />
            <span className="text-[10px] text-lightText dark:text-zinc-400 font-medium">Cancelled as Fraud</span>
          </div>
          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 px-2 py-0.5 rounded-full font-medium">
            Last 6 Months
          </span>
        </div>
      </div>
      {/* Bar chart — uses pixel heights to avoid flex-container percentage bug */}
      <div className="flex items-end gap-3 w-full" style={{ height: "120px" }}>
        {profits.map((val, i) => {
          const MAX_PX = 88; // max bar pixel height within the 120px container
          const barPx = maxVal > 0 ? Math.max(2, (val / maxVal) * MAX_PX) : 2;
          const cancelledVal = cancelledVals[i] || 0;
          const cancelledBarPx = maxVal > 0 ? Math.max(2, (cancelledVal / maxVal) * MAX_PX) : 2;

          const isProfitEmpty = val === 0;
          const isCancelledEmpty = cancelledVal === 0;

          return (
            <div key={i} className="relative flex flex-col items-center justify-end flex-1 min-w-0 h-full">
              {/* Value labels or bars side by side */}
              <div className="flex items-end gap-1.5 w-full h-[100px] justify-center">
                {/* Net Profit Bar */}
                <div className="relative group/profit flex-1 h-full flex flex-col justify-end items-center">
                  {/* Hover tooltip */}
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-accent text-white text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover/profit:opacity-100 transition-opacity z-10 shadow-lg pointer-events-none">
                    {isProfitEmpty ? "No profit" : `Net Profit: $${Math.round(val).toLocaleString("en-US")}`}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-accent" />
                  </div>
                  {/* Value label */}
                  <span className="text-[7px] text-lightText dark:text-zinc-400 font-medium mb-1 text-center leading-none">
                    {isProfitEmpty ? "—" : `$${(val / 1000).toFixed(0)}k`}
                  </span>
                  <div
                    className="w-full rounded-t-xs transition-all duration-700 bg-gradient-to-t from-emerald-500 to-teal-400 shadow-xs hover:opacity-95"
                    style={{ height: `${barPx}px` }}
                  />
                </div>

                {/* Cancelled Bar */}
                <div className="relative group/cancelled flex-1 h-full flex flex-col justify-end items-center">
                  {/* Hover tooltip */}
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-slate-500 text-white text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover/cancelled:opacity-100 transition-opacity z-10 shadow-lg pointer-events-none">
                    {isCancelledEmpty ? "No cancelled orders" : `Cancelled as Fraud: $${Math.round(cancelledVal).toLocaleString("en-US")}`}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-500" />
                  </div>
                  {/* Value label */}
                  <span className="text-[7px] text-lightText dark:text-zinc-400 font-medium mb-1 text-center leading-none">
                    {isCancelledEmpty ? "—" : `$${(cancelledVal / 1000).toFixed(0)}k`}
                  </span>
                  <div
                    className="w-full rounded-t-xs transition-all duration-700 bg-slate-400 shadow-xs hover:opacity-95"
                    style={{ height: `${cancelledBarPx}px` }}
                  />
                </div>
              </div>
              {/* Month label */}
              <span className="text-[8px] text-lightText/70 dark:text-zinc-500 truncate w-full text-center mt-1.5 leading-none">
                {chart.labels[i].split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// ─── Products Tab ────────────────────────────────────────────────────────────
const ProductsTab = ({ vendorId }: { vendorId: string }) => {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/vendor/products?vendor_id=${vendorId}`);
        const data = await res.json();
        if (data.success) {
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error("Failed to load vendor products:", err);
      } finally {
        setLoading(false);
      }
    };
    if (vendorId) fetchProducts();
  }, [vendorId]);

  useRealtime({
    "inventory:updated": (data) => {
      const prodId = data.productId as string;
      const newStock = Number(data.stock);
      setProducts((prev) =>
        prev.map((p) => (p._id === prodId ? { ...p, quantity: newStock } : p))
      );
    },
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Your Listed Products</h3>
          <p className="text-xs text-lightText dark:text-zinc-400 mt-0.5">{products.length} product{products.length !== 1 ? "s" : ""} listed</p>
        </div>
        <Link
          href="/vendor/products/new"
          className="px-3 py-1.5 bg-lightOrange text-white text-xs font-bold rounded-lg hover:bg-darkOrange transition-colors"
        >
          + List a Product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-10 text-lightText dark:text-zinc-400">
          <span className="text-4xl block mb-3"></span>
          <p className="font-semibold text-sm text-accent dark:text-zinc-100">No products listed yet</p>
          <p className="text-xs mt-1">Add your first product to start selling on DCart</p>
          <Link
            href="/vendor/products/new"
            className="mt-4 px-4 py-2 bg-accent dark:bg-zinc-800 text-white dark:text-zinc-100 text-sm font-bold rounded-xl hover:bg-slate-700 dark:hover:bg-zinc-700 transition-colors block w-fit mx-auto"
          >
            List Your First Product
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-lightText dark:text-zinc-400">
                <th className="py-2.5 pr-4">Product</th>
                <th className="py-2.5 px-2">Category</th>
                <th className="py-2.5 px-2">Price</th>
                <th className="py-2.5 px-2">Stock</th>
                <th className="py-2.5 px-2">Listed</th>
                <th className="py-2.5 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {products.map((product) => {
                const firstImage = product.variants?.[0]?.images?.[0] || "";
                return (
                  <tr key={product._id} className="text-xs hover:bg-gray-50 dark:hover:bg-zinc-850/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {firstImage ? (
                          <Image
                            src={firstImage}
                            alt={product.title}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-lg object-cover border border-gray-100 dark:border-zinc-800"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 dark:text-zinc-500 text-xs font-bold uppercase text-center leading-none">
                            No Image
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-accent dark:text-zinc-100 truncate max-w-[200px]">{product.title}</p>
                          <p className="text-[10px] text-lightText dark:text-zinc-400 font-mono">{product._id.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-lightText dark:text-zinc-400 capitalize">{product.category}</td>
                    <td className="py-3 px-2 font-bold text-accent dark:text-zinc-100"><FormattedPrice amount={product.price} /></td>
                    <td className="py-3 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        product.quantity > 10
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : product.quantity > 0
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400"
                            : "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"
                      }`}>
                        {product.quantity} in stock
                      </span>
                    </td>
                    <td className="py-3 px-2 text-lightText dark:text-zinc-400">
                      {new Date(product.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {product.slug && (
                        <Link
                          href={`/product/${product.slug}`}
                          className="text-[10px] text-lightOrange hover:text-darkOrange font-bold transition-colors"
                        >
                          View →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Payout History Item ─────────────────────────────────────────────────────
interface PayoutRecord {
  id: string;
  orderId: string;
  amount: number;
  approvedAt: string;
  email: string;
}

// ─── Return Request ───────────────────────────────────────────────────────────
interface ReturnRequest {
  id: string;
  email: string;
  amount: number;
  items: Array<{ _id?: string; title?: string; quantity?: number; price?: number }>;
  return_reason: string;
  return_requested_at: string;
  return_status: string;
  order_status: string;
  seller_rejection_reason?: string;
}

// ─── Returns Tab ─────────────────────────────────────────────────────────────
const ReturnsTab = ({ vendorId, onStatsRefresh }: { vendorId: string; onStatsRefresh: () => void }) => {
  const [returns, setReturns] = React.useState<ReturnRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const fetchReturns = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/returns?vendor_id=${encodeURIComponent(vendorId)}`);
      const data = await res.json();
      if (data.success) setReturns(data.returns || []);
    } catch (err) {
      console.error("Failed to fetch returns:", err);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  React.useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleAction = async (orderId: string, email: string, action: "approve" | "reject", reason?: string) => {
    setProcessingId(orderId);
    try {
      const res = await fetch("/api/vendor/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email, action, rejectionReason: reason, vendorId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === "approve" ? "Return approved! Stock updated." : "Return rejected and escalated to admin.");
        setRejectingId(null);
        setRejectionReason("");
        fetchReturns();
        onStatsRefresh();
      } else {
        toast.error(data.error || "Action failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = returns.filter((r) => r.return_status === "return_pending").length;
  const rejectedCount = returns.filter((r) => r.return_status === "return_seller_rejected").length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Total Requests",
            value: returns.length.toString(),
            sub: "All return requests",
            color: "bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-900/50 text-slate-700 dark:text-slate-400",
          },
          {
            label: "Pending Your Review",
            value: pendingCount.toString(),
            sub: "Awaiting action",
            color: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400",
          },
          {
            label: "Escalated to Admin",
            value: rejectedCount.toString(),
            sub: "Seller rejected → admin review",
            color: "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-400",
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className={`border rounded-xl p-4 text-center ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-semibold mt-1">{label}</p>
            <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Return requests table */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Return Requests</h3>
            <p className="text-xs text-lightText dark:text-zinc-400 mt-0.5">Review and action pending returns</p>
          </div>
          <button
            onClick={fetchReturns}
            className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-350 text-xs font-bold rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {returns.length === 0 ? (
          <div className="text-center py-12 text-lightText dark:text-zinc-400">
            <span className="text-4xl block mb-3">↩️</span>
            <p className="font-semibold text-sm text-accent dark:text-zinc-100">No return requests</p>
            <p className="text-xs mt-1">Return requests from customers will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-lightText dark:text-zinc-400">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {returns.map((ret) => {
                  const isPending = ret.return_status === "return_pending";
                  const isEscalated = ret.return_status === "return_seller_rejected";
                  const isProcessing = processingId === ret.id;
                  const isRejectingThis = rejectingId === ret.id;

                  return (
                    <React.Fragment key={ret.id}>
                      <tr className="text-xs hover:bg-gray-50/50 dark:hover:bg-zinc-850/50 transition-colors">
                        <td className="px-5 py-3 font-mono font-bold text-accent dark:text-zinc-100">
                          #{ret.id.slice(-8).toUpperCase()}
                        </td>
                        <td className="px-5 py-3 text-lightText dark:text-zinc-400 truncate max-w-[120px]">{ret.email}</td>
                        <td className="px-5 py-3 font-bold text-accent dark:text-zinc-100">
                          <FormattedPrice amount={ret.amount} className="text-xs font-bold" />
                        </td>
                        <td className="px-5 py-3 text-lightText dark:text-zinc-400 max-w-[160px]">
                          <span className="line-clamp-2">{ret.return_reason}</span>
                        </td>
                        <td className="px-5 py-3 text-lightText dark:text-zinc-400 whitespace-nowrap">
                          {ret.return_requested_at
                            ? new Date(ret.return_requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isPending
                              ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50"
                              : "bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50"
                          }`}>
                            {isPending ? "⏳ Pending" : "🔍 Escalated"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleAction(ret.id, ret.email, "approve")}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-[10px] transition-all disabled:opacity-50"
                              >
                                {isProcessing ? "..." : "Approve"}
                              </button>
                              <button
                                onClick={() => setRejectingId(isRejectingThis ? null : ret.id)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-[10px] transition-all disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {isEscalated && (
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">Sent to Admin</span>
                          )}
                        </td>
                      </tr>
                      {/* Rejection reason inline form */}
                      {isRejectingThis && (
                        <tr className="bg-red-50/50 dark:bg-red-950/10">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Enter reason for rejection (shown to customer via admin)..."
                                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-zinc-900 text-accent dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-300/30"
                              />
                              <button
                                onClick={() => handleAction(ret.id, ret.email, "reject", rejectionReason)}
                                disabled={!rejectionReason.trim() || !!processingId}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-[10px] transition-all disabled:opacity-50"
                              >
                                Confirm Reject
                              </button>
                              <button
                                onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                                className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold rounded-lg text-[10px] transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function VendorDashboardPage() {
  const { data: session, status: authStatus, update } = useSession();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "payouts" | "orders" | "returns">("overview");
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isApprovedSeller, setIsApprovedSeller] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);

  // Trigger auto-deliver check on mount
  useEffect(() => {
    fetch("/api/cron/auto-deliver").catch(() => {});
  }, []);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) {
      setCheckingAuth(false);
      return;
    }

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/profile");
        const data = await res.json();
        if (data.success && data.user) {
          const freshRole = data.user.role;
          const freshStatus = data.user.sellerStatus;
          const freshVendorId = data.user.vendorId;

          if (freshRole === "seller" && freshStatus === "approved") {
            setIsApprovedSeller(true);
            setVendorId(freshVendorId);
            setCheckingAuth(false);
            
            // If session is stale, silently trigger next-auth refresh
            const sessionUser = session?.user as { role?: string; sellerStatus?: string; vendorId?: string } | undefined;
            if (
              sessionUser?.role !== freshRole ||
              sessionUser?.sellerStatus !== freshStatus ||
              sessionUser?.vendorId !== freshVendorId
            ) {
              update();
            }
          } else {
            setCheckingAuth(false);
          }
        } else {
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error("Seller auth check failed:", err);
        setCheckingAuth(false);
      }
    }

    checkAuth();
  }, [session, authStatus, router, update]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      // Pass vendor_id so the API returns only orders for this seller's products
      const url = vendorId
        ? `/api/vendor/orders?vendor_id=${encodeURIComponent(vendorId)}`
        : "/api/vendor/orders";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Error loading vendor orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (activeTab === "orders") {
      fetchOrders();
    }
  }, [activeTab, fetchOrders]);

  const handleDispatch = async (orderId: string, email: string) => {
    const loadingToast = toast.loading("Dispatching order...");
    try {
      const res = await fetch("/api/vendor/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Order dispatched successfully!");
        fetchOrders();
      } else {
        toast.error(data.message || "Failed to dispatch order.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during dispatch.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const fetchPayoutHistory = useCallback(async () => {
    if (!vendorId) return;
    setPayoutsLoading(true);
    try {
      const res = await fetch(`/api/vendor/payouts?vendor_id=${encodeURIComponent(vendorId)}`);
      const d = await res.json();
      if (d.success) setPayoutHistory(d.payouts || []);
    } catch { /* silent */ } finally {
      setPayoutsLoading(false);
    }
  }, [vendorId]);

  const fetchDashboard = useCallback((showLoading = false) => {
    if (!vendorId) return;
    if (showLoading) setLoading(true);
    fetch(`/api/vendor/dashboard?vendor_id=${vendorId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d); })
      .catch(() => {})
      .finally(() => { if (showLoading) setLoading(false); });
  }, [vendorId]);

  useEffect(() => {
    fetchDashboard(true);
  }, [fetchDashboard]);

  useEffect(() => {
    if (activeTab === "payouts" && vendorId) {
      fetchPayoutHistory();
    }
  }, [activeTab, fetchPayoutHistory, vendorId]);

  useRealtime({
    "order:created": () => {
      fetchDashboard(false);
      fetchOrders();
    },
    "order:cancelled": () => {
      fetchDashboard(false);
      fetchOrders();
    },
    "order:dispatched": () => {
      fetchDashboard(false);
      fetchOrders();
    },
    "order:delivered": () => {
      fetchDashboard(false);
      fetchOrders();
    },
    "order:returned": () => {
      fetchDashboard(false);
      fetchOrders();
    },
    "order:return_requested": () => {
      // New return request came in — the ReturnsTab handles its own refresh via realtime
      fetchDashboard(false);
    },
    "order:return_dispatched": () => {
      fetchDashboard(false);
      fetchOrders();
    },
    "payout:approved": () => {
      // Admin approved a payout — refresh dashboard totals and payout history
      fetchDashboard(false);
      fetchPayoutHistory();
    },
    "payout:rejected": () => {
      fetchPayoutHistory();
    },
  });

  if (authStatus === "loading" || (checkingAuth && !data)) {
    return <Loader title="Loading your seller dashboard..." className="min-h-screen" />;
  }

  if (!session?.user) {
    return (
      <Container className="py-20 bg-gray-50 dark:bg-zinc-950 min-h-screen flex items-center justify-center">
        <AccessDenied
          message="Access is denied to view the page. Sign in first."
          buttonText="Sign In"
          buttonHref={`/signin?callbackUrl=${encodeURIComponent("/vendor/dashboard")}`}
        />
      </Container>
    );
  }

  if (!isApprovedSeller) {
    return (
      <Container className="py-20 bg-gray-50 dark:bg-zinc-950 min-h-screen flex items-center justify-center">
        <AccessDenied message="You do not have the authority to access this page. Only approved sellers can access the vendor dashboard." />
      </Container>
    );
  }

  if (loading) {
    return <Loader title="Loading your seller dashboard..." className="min-h-screen" />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lightText dark:text-zinc-400 mb-4">Could not load seller dashboard.</p>
          <Link href="/" className="px-4 py-2 bg-lightOrange text-white rounded-xl font-bold text-sm hover:bg-darkOrange transition-colors">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Revenue",
      value: `$${(data.total_revenue / 1000).toFixed(1)}k`,
      sub: "Gross from all orders",
      icon: "",
      color: "from-amber-50 to-orange-50",
      sparkData: data.monthly_chart.revenue,
    },
    {
      label: "Potential Earnings",
      value: `$${(data.vendor_earnings / 1000).toFixed(1)}k`,
      sub: `All orders, after ${Math.round(data.commission_rate * 100)}% commission`,
      icon: "",
      color: "from-sky-50 to-blue-50",
      sparkData: data.monthly_chart.revenue.map((v) => v * (1 - data.commission_rate)),
    },
    {
      label: "Confirmed Earnings",
      value: `$${((data.confirmed_earnings ?? 0) / 1000).toFixed(1)}k`,
      sub: "Delivered orders only \u2014 ready for payout",
      icon: "",
      color: "from-emerald-50 to-green-50",
      sparkData: data.monthly_chart.revenue.map((v) => v * (1 - data.commission_rate)),
    },
    {
      label: "Total Orders",
      value: data.total_orders.toString(),
      sub: `Avg $${Math.round(data.avg_order_value).toLocaleString("en-US")} per order`,
      icon: "",
      color: "from-blue-50 to-indigo-50",
      sparkData: data.monthly_chart.orders,
    },
    {
      label: "Pending Payout",
      value: `$${(data.pending_payout / 1000).toFixed(1)}k`,
      sub: data.pending_payout > 0 ? "Awaiting admin approval" : "All payouts up to date ✔",
      icon: "",
      color: "from-purple-50 to-violet-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-12 transition-colors duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-zinc-900 dark:to-zinc-950 text-white py-8">
        <div className="w-full px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lightOrange text-xs font-bold bg-lightOrange/20 px-2 py-0.5 rounded-full">
                  Seller Dashboard
                </span>
                {data.profile?.status && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    data.profile.approved
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}>
                    {data.profile.approved ? "Approved" : "Pending"}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold">{data.profile?.store_name || "My DCart Store"}</h1>
              <p className="text-white/60 text-sm mt-0.5">
                {data.profile?.primary_category || "General"} • Commission: {Math.round(data.commission_rate * 100)}%
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/vendor/products/new"
                className="px-4 py-2 bg-white/10 border border-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/20 transition-colors"
              >
                + List a Product
              </Link>
              <Link
                href="/"
                className="px-4 py-2 bg-lightOrange text-white text-sm font-semibold rounded-xl hover:bg-darkOrange transition-colors"
              >
                View Store →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-1 gap-1 w-fit shadow-xs flex-wrap">
          {(["overview", "products", "payouts", "orders", "returns"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${
                activeTab === tab 
                  ? "bg-accent dark:bg-zinc-100 text-white dark:text-black font-bold" 
                  : "text-lightText hover:text-accent dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "products" ? "Products" : tab === "payouts" ? "Payouts" : tab === "orders" ? "Orders" : "Returns ↩️"}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s) => (
                <StatCard key={s.label} {...s} />
              ))}
            </div>

            {/* Revenue Chart + Commission Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <ProfitChart chart={data.monthly_chart} commissionRate={data.commission_rate} />
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Commission Breakdown</h3>
                {[
                  { label: "Gross Revenue", value: data.total_revenue, color: "text-accent dark:text-zinc-100" },
                  { label: "Platform Commission", value: -data.platform_commission, color: "text-red-500 dark:text-red-400" },
                  { label: "Net Earnings", value: data.vendor_earnings, color: "text-emerald-600 dark:text-emerald-400 font-bold" },
                  { label: "Paid Out", value: data.total_paid_out, color: "text-blue-600 dark:text-blue-400" },
                  { label: "Pending Payout", value: data.pending_payout, color: "text-amber-600 dark:text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center text-sm border-b border-gray-50 dark:border-zinc-800 pb-2 last:border-0 last:pb-0">
                    <span className="text-lightText dark:text-zinc-400">{label}</span>
                    <span className={`font-semibold ${color}`}>
                      {value < 0 ? "-" : ""}<FormattedPrice amount={Math.abs(value)} className="text-sm font-semibold inline" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Products tab — real data */}
        {activeTab === "products" && vendorId && (
          <ProductsTab vendorId={vendorId} />
        )}

        {/* Payouts tab */}
        {activeTab === "payouts" && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: "Confirmed Earnings",
                  value: `$${((data.confirmed_earnings ?? 0) / 1000).toFixed(1)}k`,
                  sub: "Delivered orders",
                  color: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400",
                },
                {
                  label: "Paid Out",
                  value: `$${(data.total_paid_out / 1000).toFixed(1)}k`,
                  sub: "Approved by admin",
                  color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400",
                },
                {
                  label: "Pending Approval",
                  value: `$${(data.pending_payout / 1000).toFixed(1)}k`,
                  sub: "Awaiting admin",
                  color: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400",
                },
                {
                  label: "Potential Earnings",
                  value: `$${(data.vendor_earnings / 1000).toFixed(1)}k`,
                  sub: "All orders (incl. in-transit)",
                  color: "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50 text-sky-700 dark:text-sky-400",
                },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className={`border rounded-xl p-4 text-center ${color}`}>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs font-semibold mt-1">{label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Pending payout notice */}
            {data.pending_payout > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">⏳</span>
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Payout Pending Admin Approval</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    ${data.pending_payout.toFixed(2)} is awaiting approval from the DCart admin. You&apos;ll be notified once it&apos;s approved.
                  </p>
                </div>
              </div>
            )}

            {/* Payout History */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Payout History</h3>
                <button
                  onClick={fetchPayoutHistory}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-350 text-xs font-bold rounded-lg transition-colors"
                >
                  Refresh
                </button>
              </div>
              {payoutsLoading ? (
                <div className="space-y-3 p-5">
                  {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />)}
                </div>
              ) : payoutHistory.length === 0 ? (
                <div className="text-center py-10 text-lightText dark:text-zinc-400">
                  <span className="text-3xl block mb-2">💸</span>
                  <p className="text-sm font-semibold text-accent dark:text-zinc-100">No approved payouts yet.</p>
                  <p className="text-xs mt-1">Once the admin approves your earnings, they&apos;ll appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-lightText dark:text-zinc-400">
                        <th className="px-5 py-3">Order ID</th>
                        <th className="px-5 py-3">Amount Paid</th>
                        <th className="px-5 py-3">Approved On</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                      {payoutHistory.map((payout) => (
                        <tr key={payout.id} className="text-xs hover:bg-gray-50 dark:hover:bg-zinc-850/50 transition-colors">
                          <td className="px-5 py-3 font-mono font-semibold text-accent dark:text-zinc-200">
                            {payout.orderId.slice(-8).toUpperCase()}
                          </td>
                          <td className="px-5 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                            ${payout.amount.toFixed(2)}
                          </td>
                          <td className="px-5 py-3 text-lightText dark:text-zinc-400">
                            {new Date(payout.approvedAt).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                              ✓ Paid Out
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders tab */}
        {activeTab === "orders" && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-accent dark:text-zinc-100">Customer Orders</h3>
              <button
                onClick={fetchOrders}
                className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-350 text-xs font-bold rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>

            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-10 text-lightText dark:text-zinc-400">
                <span className="text-4xl block mb-3"></span>
                <p className="font-semibold text-sm text-accent dark:text-zinc-100">No orders received yet</p>
                <p className="text-xs mt-1">Orders placed by customers will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-lightText dark:text-zinc-400">
                      <th className="py-2.5">Order ID</th>
                      <th className="py-2.5">Customer</th>
                      <th className="py-2.5">Items</th>
                      <th className="py-2.5">Total Amount</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                    {orders.map((order) => {
                      const status = order.value?.status || "Pending";
                      return (
                        <tr key={order.id} className="text-xs hover:bg-gray-50/50 dark:hover:bg-zinc-850/50 transition-colors">
                          <td className="py-3 font-semibold text-accent dark:text-zinc-100 font-mono">{order.id.slice(-8)}</td>
                          <td className="py-3 text-lightText dark:text-zinc-400">{order.email}</td>
                          <td className="py-3 text-lightText dark:text-zinc-400">
                            {order.value?.items?.map((item: OrderItem, idx: number) => (
                              <div key={idx} className="truncate max-w-[200px]">
                                {item.title} (x{item.quantity})
                              </div>
                            ))}
                          </td>
                          <td className="py-3 font-bold text-accent dark:text-zinc-100"><FormattedPrice amount={order.value?.amount} className="text-xs font-bold" /></td>
                          <td className="py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              status === "Delivered"
                                ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50"
                                : status === "Dispatched"
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50"
                                : status === "Cancelled" || status === "Flagged Fraud" || status === "Cancelled as Fraud"
                                  ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50"
                                  : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50"
                            }`}>
                              {status === "Delivered" ? "✓ Delivered" : status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {status === "Paid" || status === "Pending" ? (
                              <button
                                onClick={() => handleDispatch(order.id, order.email)}
                                className="px-3 py-1 bg-darkOrange text-white font-bold rounded-lg hover:bg-lightOrange transition-all text-[10px]"
                              >
                                Dispatch Order
                              </button>
                            ) : status === "Delivered" ? (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">✓ Delivered</span>
                            ) : (
                              <span className="text-[10px] text-lightText/60 dark:text-zinc-500 font-medium">No actions</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Returns tab */}
        {activeTab === "returns" && vendorId && (
          <ReturnsTab vendorId={vendorId} onStatsRefresh={() => fetchDashboard(false)} />
        )}
      </div>
    </div>
  );
}
