"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FiDollarSign, FiShoppingBag, FiUsers, FiTrendingUp, FiPercent, FiBarChart2 } from "react-icons/fi";
import FormattedPrice from "./FormattedPrice";
import { useRealtime } from "@/hooks/useRealtime";

interface AnalyticsData {
  cards: {
    totalRevenue: number;
    totalOrders: number;
    totalViews: number;
    uniqueConsumerVisitors: number;
    activeUsers: number;
    conversionRate: number;
    platformCommission: number;
    platformProfit: number;
    commissionRate: number;
  };
  chartData: Array<{
    date: string;
    revenue: number;
    orders: number;
    cancelled: number;
    cancelledOrdersCount: number;
  }>;
  topProducts: Array<{
    id: string;
    title: string;
    brand: string;
    price: number;
    salesCount: number;
  }>;
  topCategories: Array<{
    name: string;
    salesCount: number;
  }>;
}

const COLORS = ["#fa8900", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

const AdminAnalytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAnalytics = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/analytics`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(true);
  }, [fetchAnalytics]);

  useRealtime({
    "analytics:updated": () => {
      fetchAnalytics(false);
    }
  });

  if (!mounted) {
    return <div className="min-h-[400px] w-full bg-zinc-50 animate-pulse rounded-md"></div>;
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200/60 border border-gray-100 rounded-lg shadow-sm" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[350px] bg-gray-200/60 border border-gray-100 rounded-lg shadow-sm" />
          <div className="h-[350px] bg-gray-200/60 border border-gray-100 rounded-lg shadow-sm" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-10 bg-white border rounded-lg shadow-sm">
        <p className="text-lightText">Failed to load business intelligence metrics.</p>
      </div>
    );
  }

  const { cards, chartData, topProducts, topCategories } = data;

  return (
    <div className="flex flex-col gap-6 py-6">

      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">

        <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-lightText">Total Revenue</span>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <FiDollarSign className="text-lg" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-accent">
            <FormattedPrice amount={cards.totalRevenue} />
          </h3>
          <p className="text-xs text-green-600 mt-2 font-medium">
            <span className="text-lightText">{cards.totalRevenue > 0 ? "From real orders" : "No orders yet"}</span>
          </p>
        </div>


        <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-lightText">Sales &amp; Orders</span>
            <div className="p-2 bg-orange-50 text-lightOrange rounded-lg">
              <FiShoppingBag className="text-lg" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-accent">{cards.totalOrders}</h3>
          <p className="text-xs text-lightOrange mt-2 font-medium">
            <span className="text-lightText">{cards.totalOrders > 0 ? "From real orders" : "No orders yet"}</span>
          </p>
        </div>


        <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-lightText">Active Customers</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <FiUsers className="text-lg" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-accent">{cards.activeUsers}</h3>
          <p className="text-xs text-purple-600 mt-2 font-medium">
            <span className="text-lightText">{cards.activeUsers > 0 ? `${cards.activeUsers} unique buyer${cards.activeUsers !== 1 ? "s" : ""}` : "No buyers yet"}</span>
          </p>
        </div>


        <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-lightText">Conversion Rate</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FiTrendingUp className="text-lg" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-accent">{cards.conversionRate}%</h3>
          <p className="text-xs text-blue-600 mt-2 font-medium">
            {cards.uniqueConsumerVisitors} <span className="text-lightText">unique consumer visitors</span>
          </p>
        </div>


        <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-lightText">Commission Earned</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <FiPercent className="text-lg" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-accent">
            <FormattedPrice amount={cards.platformCommission || 0} />
          </h3>
          <p className="text-xs text-teal-600 mt-2 font-medium">
            <span className="text-lightText">{Math.round((cards.commissionRate || 0.1) * 100)}% avg platform fee</span>
          </p>
        </div>


        <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-lightText">Total Profit</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <FiBarChart2 className="text-lg" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600">
            <FormattedPrice amount={cards.platformProfit || 0} />
          </h3>
          <p className="text-xs text-emerald-600 mt-2 font-medium">
            <span className="text-lightText">{cards.totalOrders > 0 ? "Net platform profit" : "No orders yet"}</span>
          </p>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-bold text-accent mb-4">Revenue Trend (Last 7 Days)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} stroke="#e5e7eb" />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} stroke="#e5e7eb" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Bar dataKey="revenue" fill="#fa8900" radius={[4, 4, 0, 0]} name="Revenue ($)" />
                <Bar dataKey="cancelled" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Cancelled as Fraud ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-accent mb-4">Top Categories Shares</h3>
          <div className="h-[220px] w-full flex justify-center items-center">
            {topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="salesCount"
                  >
                    {topCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-lightText">No category data available</p>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-3 text-xs">
            {topCategories.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-accent">{entry.name}</span>
                <span className="text-lightText">({entry.salesCount})</span>
              </div>
            ))}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-bold text-accent mb-4">Top Performing Products</h3>
          <div className="flex flex-col gap-4">
            {topProducts.map((item) => {
              const maxSales = Math.max(...topProducts.map((p) => p.salesCount), 1);
              const percentage = (item.salesCount / maxSales) * 100;
              return (
                <div key={item.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-semibold text-accent">{item.title}</span>
                      <span className="text-xs text-lightText ml-2 font-medium">by {item.brand}</span>
                    </div>
                    <span className="font-bold text-darkOrange">{item.salesCount} sold</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lightOrange rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-bold text-accent mb-4">Daily Order Volumes</h3>
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} stroke="#e5e7eb" />
                <Tooltip />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Orders" />
                <Bar dataKey="cancelledOrdersCount" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Cancelled as Fraud" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      <AdminReturnsPanel />
    </div>
  );
};


interface AdminReturnRecord {
  id: string;
  orderId: string;
  email: string;
  vendorId: string;
  store_name?: string;
  return_reason: string;
  seller_rejection_reason: string;
  return_requested_at: string;
  escalated_at: string;
  status: string;
  order_amount?: number;
  order_items?: Array<{ _id?: string; title?: string; quantity?: number; price?: number }>;
}

const AdminReturnsPanel = () => {
  const [returns, setReturns] = React.useState<AdminReturnRecord[]>([]);
  const [returnsLoading, setReturnsLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const fetchReturns = useCallback(async (showLoading = true) => {
    if (showLoading) setReturnsLoading(true);
    try {
      const res = await fetch("/api/admin/returns");
      const data = await res.json();
      if (data.success) setReturns(data.returns || []);
    } catch (err) {
      console.error("Failed to fetch admin returns:", err);
    } finally {
      if (showLoading) setReturnsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchReturns(); }, [fetchReturns]);

  useRealtime({
    "order:return_seller_rejected": () => fetchReturns(false),
    "order:returned": () => fetchReturns(false),
    "order:return_admin_declined": () => fetchReturns(false),
  });

  const handleAction = async (rec: AdminReturnRecord, action: "approve" | "decline") => {
    setProcessingId(rec.id);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminReturnId: rec.id,
          orderId: rec.orderId,
          email: rec.email,
          vendorId: rec.vendorId,
          action,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // optimistic remove
        setReturns((prev) => prev.filter((r) => r.id !== rec.id));
      } else {
        console.error("Admin return action failed:", data.error);
      }
    } catch (err) {
      console.error("Admin return action error:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const escalatedReturns = returns.filter((r) => r.status === "escalated");

  return (
    <div className="bg-white border border-gray-200/60 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-bold text-accent">Returns Management ↩️</h3>
          <p className="text-xs text-lightText mt-0.5">
            Escalated return requests requiring admin decision
          </p>
        </div>
        <div className="flex items-center gap-3">
          {escalatedReturns.length > 0 && (
            <span className="px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold rounded-full">
              {escalatedReturns.length} pending
            </span>
          )}
          <button
            onClick={() => fetchReturns()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {returnsLoading ? (
        <div className="space-y-3 p-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : escalatedReturns.length === 0 ? (
        <div className="text-center py-10 text-lightText">
          <span className="text-3xl block mb-2">✅</span>
          <p className="text-sm font-semibold text-accent">No escalated returns</p>
          <p className="text-xs mt-1">All return escalations have been resolved.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-lightText">
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Store</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Return Reason</th>
                <th className="px-5 py-3">Seller Note</th>
                <th className="px-5 py-3">Escalated</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {escalatedReturns.map((rec) => {
                const isProcessing = processingId === rec.id;
                return (
                  <tr key={rec.id} className="text-xs hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-accent">
                      #{rec.orderId.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-5 py-3 text-lightText truncate max-w-[120px]">{rec.email}</td>
                    <td className="px-5 py-3 text-lightText font-medium">{rec.store_name || rec.vendorId}</td>
                    <td className="px-5 py-3 font-bold text-accent">
                      {rec.order_amount ? `$${rec.order_amount.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-lightText max-w-[160px]">
                      <span className="line-clamp-2">{rec.return_reason}</span>
                    </td>
                    <td className="px-5 py-3 text-lightText max-w-[140px]">
                      <span className="line-clamp-2 text-red-600">{rec.seller_rejection_reason}</span>
                    </td>
                    <td className="px-5 py-3 text-lightText whitespace-nowrap">
                      {rec.escalated_at
                        ? new Date(rec.escalated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(rec, "approve")}
                          disabled={isProcessing}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-[10px] transition-all disabled:opacity-50"
                        >
                          {isProcessing ? "..." : "Approve Return"}
                        </button>
                        <button
                          onClick={() => handleAction(rec, "decline")}
                          disabled={isProcessing}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-[10px] transition-all disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
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


export default AdminAnalytics;

