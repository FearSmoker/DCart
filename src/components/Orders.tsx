"use client";
import { useSession } from "next-auth/react";
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import FormattedPrice from "./FormattedPrice";
import { ProductData } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import Table, {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui";
import { MdClose } from "react-icons/md";
import toast from "react-hot-toast";
import { useRealtime } from "@/hooks/useRealtime";
import RecommendedProducts from "./RecommendedProducts";
import Loader from "./Loader";

interface Order {
  id: string;
  email?: string;
  timestamp?: string;
  value: {
    amount: number;
    items: ProductData[];
    status?: string;
    return_status?: string;
    return_reason?: string;
    return_requested_at?: string;
    seller_rejection_reason?: string;
    shippingAddress?: {
      name: string;
      contactNo: string;
      street: string;
      city: string;
      state: string;
      zipCode: string;
      label: string;
    };
  };
}

// ─── Return reason options ──────────────────────────────────────────────────
const RETURN_REASONS = [
  "Defective / Damaged product",
  "Wrong item delivered",
  "Not as described",
  "Changed my mind",
  "Arrived too late",
  "Other",
];

// ─── Return Reason Modal ────────────────────────────────────────────────────
interface ReturnReasonModalProps {
  orderId: string;
  onClose: () => void;
  onSubmit: (orderId: string, reason: string) => Promise<void>;
}

const ReturnReasonModal = ({ orderId, onClose, onSubmit }: ReturnReasonModalProps) => {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finalReason = selectedReason === "Other" ? customReason.trim() : selectedReason;

  const handleSubmit = async () => {
    if (!finalReason) {
      toast.error("Please select or enter a reason.");
      return;
    }
    setSubmitting(true);
    await onSubmit(orderId, finalReason);
    setSubmitting(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Modal card */}
        <motion.div
          className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
          initial={{ opacity: 0, y: 32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-accent dark:text-zinc-100">Request a Return</h2>
              <p className="text-xs text-lightText dark:text-zinc-400 mt-0.5">
                Order #{orderId.slice(-10).toUpperCase()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-lightText dark:text-zinc-400"
            >
              <MdClose className="text-lg" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs font-semibold text-lightText dark:text-zinc-400 uppercase tracking-wide">
              Select reason for return
            </p>

            <div className="space-y-2">
              {RETURN_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedReason === reason
                      ? "border-lightOrange bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700/50"
                      : "border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="return-reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-lightOrange"
                  />
                  <span className="text-sm text-accent dark:text-zinc-200">{reason}</span>
                </label>
              ))}
            </div>

            {/* Custom reason textarea */}
            <AnimatePresence>
              {selectedReason === "Other" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Please describe the reason for your return..."
                    rows={3}
                    className="w-full mt-2 px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-accent dark:text-zinc-200 placeholder:text-lightText/60 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-lightOrange/30 resize-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-zinc-700 text-lightText dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !finalReason}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-lightOrange hover:bg-darkOrange text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Return Request"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── status helpers ───────────────────────────────────────────────────────────
function getPaymentBadge(status?: string, returnStatus?: string) {
  if (status === "Cancelled" || status === "Cancelled as Fraud") return { variant: "destructive" as const, label: status === "Cancelled as Fraud" ? "Cancelled as Fraud" : "Cancelled" };
  if (status === "Flagged Fraud") return { variant: "default" as const, label: "Under Review" };
  if (status === "Returned") return { variant: "default" as const, label: "Refunded" };
  if (returnStatus === "return_pending") return { variant: "default" as const, label: "Return Requested" };
  if (returnStatus === "return_approved" || status === "Dispatched for Return") return { variant: "default" as const, label: "Return In Transit" };
  if (returnStatus === "return_seller_rejected") return { variant: "default" as const, label: "Under Admin Review" };
  if (returnStatus === "return_admin_declined") return { variant: "success" as const, label: "Paid" };
  return { variant: "success" as const, label: "Paid" };
}

function getShippingBadge(status?: string, returnStatus?: string) {
  if (status === "Delivered" && !returnStatus) return { variant: "success" as const, label: "Delivered ✓" };
  if (status === "Delivered" && returnStatus === "return_pending") return { variant: "default" as const, label: "Return Requested ⏳" };
  if (status === "Delivered" && returnStatus === "return_seller_rejected") return { variant: "default" as const, label: "Escalated to Admin 🔍" };
  if (status === "Delivered" && returnStatus === "return_admin_declined") return { variant: "success" as const, label: "Delivered ✓" };
  if (status === "Dispatched for Return") return { variant: "default" as const, label: "Return In Transit ↩️" };
  if (status === "Dispatched") return { variant: "success" as const, label: "Dispatched 🚚" };
  if (status === "Cancelled" || status === "Cancelled as Fraud") return { variant: "destructive" as const, label: "Cancelled" };
  if (status === "Flagged Fraud") return { variant: "destructive" as const, label: "Under Review 🔍" };
  if (status === "Returned") return { variant: "default" as const, label: "Returned ✓ ↩️" };
  return { variant: "default" as const, label: "Processing" };
}

// ─── main orders component ────────────────────────────────────────────────────
const ordersPerPage = 5;

const Orders = () => {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnModalOrderId, setReturnModalOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams?.get("payment") === "failed") {
      toast.error("Payment unsuccessful");
    }
  }, [searchParams]);

  useEffect(() => {
    const orderIdParam = searchParams?.get("id");
    if (orderIdParam && orders.length > 0) {
      const index = orders.findIndex((o) => o.id === orderIdParam);
      if (index !== -1) {
        setExpandedOrderId(orderIdParam);
        const targetPage = Math.floor(index / ordersPerPage) + 1;
        setCurrentPage(targetPage);

        setTimeout(() => {
          const element = document.getElementById(`order-${orderIdParam}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 300);
      }
    }
  }, [searchParams, orders]);

  const fetchOrders = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchOrders();
    // trigger auto-deliver check so consumer sees delivery asap
    fetch("/api/cron/auto-deliver").catch(() => {});
  }, [fetchOrders]);

  useRealtime({
    "order:created": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        toast.success(`Order placed successfully!`);
        fetchOrders();
      }
    },
    "order:cancelled": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        toast.error(`Your order has been cancelled.`);
        fetchOrders();
      }
    },
    "order:dispatched": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        toast.success(`Your order has been dispatched! 🚚`);
        fetchOrders();
      }
    },
    "order:delivered": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        toast.success(`Your order has been delivered! 🎉`);
        fetchOrders();
      }
    },
    "order:returned": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        toast.success(`Your order has been returned! ↩️`);
        fetchOrders();
      }
    },
    "order:return_requested": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        fetchOrders();
      }
    },
    "order:return_dispatched": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        toast.success(`Your return is on its way back! ↩️`);
        fetchOrders();
      }
    },
    "order:return_admin_declined": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        toast.error(`Your return request was declined.`);
        fetchOrders();
      }
    },
    "order:updated": (data) => {
      if ((data as { email?: string }).email === session?.user?.email) {
        fetchOrders();
      }
    },
  });

  const toggleDetails = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const handleCancelOrder = async (orderId: string) => {
    const loadingToast = toast.loading("Cancelling order...");
    try {
      const res = await fetch("/api/cancelorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email: session?.user?.email }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Order cancelled successfully!");
        fetchOrders();
      } else {
        toast.error(data.message || "Failed to cancel order.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while cancelling order.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleReturnSubmit = async (orderId: string, reason: string) => {
    const loadingToast = toast.loading("Submitting return request...");
    try {
      const res = await fetch("/api/returnorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email: session?.user?.email, reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Return request submitted! The seller will review it shortly.");
        setReturnModalOrderId(null);
        fetchOrders();
      } else {
        toast.error(data.message || "Failed to submit return request.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while submitting the return request.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const totalPages = Math.ceil(orders.length / ordersPerPage);
  const activePage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const paginatedOrders = orders.slice((activePage - 1) * ordersPerPage, activePage * ordersPerPage);

  return (
    <div className="flex flex-col gap-y-8 mt-5">
      {/* Return Reason Modal */}
      {returnModalOrderId && (
        <ReturnReasonModal
          orderId={returnModalOrderId}
          onClose={() => setReturnModalOrderId(null)}
          onSubmit={handleReturnSubmit}
        />
      )}

      {/* ── order list ── */}
      {loading ? (
        <Loader title="Loading your orders..." />
      ) : (
        <div className="flex flex-col gap-5">
          {paginatedOrders.length ? (
            paginatedOrders.map((item) => {
              const returnStatus = item.value?.return_status;
              const payBadge = getPaymentBadge(item.value?.status, returnStatus);
              const shipBadge = getShippingBadge(item.value?.status, returnStatus);
              const isFraud = item.value?.status === "Flagged Fraud";
              const isCancelled = item.value?.status === "Cancelled" || item.value?.status === "Cancelled as Fraud";
              const isDispatched = item.value?.status === "Dispatched";
              const isDelivered = item.value?.status === "Delivered";
              const isReturned = item.value?.status === "Returned";
              const isDispatchedForReturn = item.value?.status === "Dispatched for Return";
              const isReturnPending = returnStatus === "return_pending";
              const isReturnSellerRejected = returnStatus === "return_seller_rejected";
              const isReturnAdminDeclined = returnStatus === "return_admin_declined";

              const orderDate = item.timestamp
                ? new Date(item.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "—";

              return (
                <div key={item.id} id={`order-${item.id}`}>
                  <Card className={expandedOrderId === item.id ? "border-darkOrange/30" : ""}>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <CardTitle>
                          Order{" "}
                          <span className="font-mono text-sm tracking-wide">
                            #{item.id.slice(-10).toUpperCase()}
                          </span>
                        </CardTitle>
                        <span className="text-xs text-lightText">{orderDate}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isFraud && (
                        <div className="mb-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
                          <span className="text-base shrink-0">⚠️</span>
                          <div>
                            <p className="font-bold">Order Under Review</p>
                            <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                              Your order has been flagged for a security review. Our team will verify and update the status shortly.
                              No payment will be charged until the review is complete.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Return status banners */}
                      {isReturnPending && (
                        <div className="mb-4 flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
                          <span className="text-base shrink-0">⏳</span>
                          <div>
                            <p className="font-bold">Return Request Submitted</p>
                            <p className="mt-0.5 text-blue-600 dark:text-blue-400">
                              Reason: <span className="font-medium">{item.value?.return_reason}</span>
                            </p>
                            <p className="mt-0.5 text-blue-500 dark:text-blue-500">
                              {"Awaiting seller review. You'll be notified once it's processed."}
                            </p>
                          </div>
                        </div>
                      )}

                      {isReturnSellerRejected && (
                        <div className="mb-4 flex items-start gap-2 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-3 text-xs text-purple-700 dark:text-purple-300">
                          <span className="text-base shrink-0">🔍</span>
                          <div>
                            <p className="font-bold">Return Under Admin Review</p>
                            <p className="mt-0.5 text-purple-600 dark:text-purple-400">
                              The seller has escalated your return to DCart admin for final review.
                            </p>
                            {item.value?.seller_rejection_reason && (
                              <p className="mt-0.5 text-purple-500 dark:text-purple-500">
                                Seller note: {item.value.seller_rejection_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {isReturnAdminDeclined && (
                        <div className="mb-4 flex items-start gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">
                          <span className="text-base shrink-0">❌</span>
                          <div>
                            <p className="font-bold">Return Request Declined</p>
                            <p className="mt-0.5 text-red-600 dark:text-red-400">
                              Your return request was reviewed and declined. If you believe this is incorrect, please contact support.
                            </p>
                          </div>
                        </div>
                      )}

                      {isDispatchedForReturn && (
                        <div className="mb-4 flex items-start gap-2 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 rounded-xl p-3 text-xs text-indigo-700 dark:text-indigo-300">
                          <span className="text-base shrink-0">↩️</span>
                          <div>
                            <p className="font-bold">Return In Transit</p>
                            <p className="mt-0.5 text-indigo-600 dark:text-indigo-400">
                              Your return has been approved and is being shipped back. Your refund will be processed shortly.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs font-medium text-black/60 dark:text-zinc-400 mb-1">Total Amount</p>
                          <FormattedPrice amount={item.value?.amount} className="text-lg font-semibold" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-black/60 dark:text-zinc-400 mb-1">Payment</p>
                          <Badge variant={payBadge.variant}>{payBadge.label}</Badge>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-black/60 dark:text-zinc-400 mb-1">Shipping</p>
                          <Badge variant={shipBadge.variant}>{shipBadge.label}</Badge>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-black/60 dark:text-zinc-400 mb-1">Items</p>
                          <span className="text-sm font-semibold text-accent dark:text-zinc-200">
                            {item.value?.items?.length ?? 0} item{(item.value?.items?.length ?? 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => toggleDetails(item.id)}>
                          {expandedOrderId === item.id ? "Hide Details" : "View Items"}
                        </Button>
                        {isCancelled ? (
                          <Button variant="delete" disabled className="opacity-50 cursor-not-allowed">
                            <MdClose className="text-base mt-0.5" /> {item.value?.status === "Cancelled as Fraud" ? "Cancelled as Fraud" : "Cancelled"}
                          </Button>
                        ) : isDispatched ? (
                          <Button variant="custom" disabled className="opacity-70 cursor-not-allowed bg-emerald-50 dark:bg-emerald-950/20 text-emerald-750 dark:text-emerald-450 border border-emerald-250 dark:border-emerald-900/50">
                            Dispatched ✓
                          </Button>
                        ) : isFraud ? (
                          <Button variant="custom" disabled className="opacity-70 cursor-not-allowed bg-amber-50 dark:bg-amber-950/20 text-amber-750 dark:text-amber-450 border border-amber-250 dark:border-amber-900/50">
                            Under Review
                          </Button>
                        ) : isReturned ? (
                          <Button variant="custom" disabled className="opacity-70 cursor-not-allowed bg-purple-50 dark:bg-purple-950/20 text-purple-750 dark:text-purple-450 border border-purple-250 dark:border-purple-900/50">
                            Returned ✓
                          </Button>
                        ) : isDispatchedForReturn ? (
                          <Button variant="custom" disabled className="opacity-70 cursor-not-allowed bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
                            Return In Transit ↩️
                          </Button>
                        ) : isReturnPending ? (
                          <Button variant="custom" disabled className="opacity-70 cursor-not-allowed bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                            Return Requested ⏳
                          </Button>
                        ) : isReturnSellerRejected ? (
                          <Button variant="custom" disabled className="opacity-70 cursor-not-allowed bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
                            Under Admin Review 🔍
                          </Button>
                        ) : isDelivered && !isReturnAdminDeclined ? (
                          <Button
                            onClick={() => setReturnModalOrderId(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Return Order ↩️
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleCancelOrder(item.id)}
                            variant="delete"
                            className="bg-red-500 hover:bg-red-600 text-white"
                          >
                            Cancel Order
                          </Button>
                        )}
                      </div>
                    </CardContent>

                    <AnimatePresence>
                      {expandedOrderId === item.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Card className="border-0 border-t rounded-none">
                            <CardHeader>
                              <CardTitle>Order Items</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {item.value?.shippingAddress && (
                                <div className="mb-5 border border-gray-150 dark:border-zinc-850 rounded-2xl p-4 bg-slate-50/50 dark:bg-zinc-850/20">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-2">
                                    Delivery Address ({item.value.shippingAddress.label})
                                  </h4>
                                  <div className="text-xs text-accent dark:text-zinc-250 space-y-0.5">
                                    <p className="font-bold">{item.value.shippingAddress.name}</p>
                                    <p className="text-lightText dark:text-zinc-400">{item.value.shippingAddress.street}</p>
                                    <p className="text-lightText dark:text-zinc-400">{item.value.shippingAddress.city}, {item.value.shippingAddress.state} - {item.value.shippingAddress.zipCode}</p>
                                    <p className="text-[11px] text-lightText dark:text-zinc-450 font-medium mt-2 flex items-center gap-1">
                                      Phone: {item.value.shippingAddress.contactNo}
                                    </p>
                                  </div>
                                </div>
                              )}
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-center">Price</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {item.value?.items?.map((product: ProductData) => (
                                    <TableRow key={product._id}>
                                      <TableCell>
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-gray-400">
                                            🛍️
                                          </div>
                                          <span className="font-medium text-sm text-accent line-clamp-2">
                                            {product?.title}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <FormattedPrice amount={product?.price} />
                                      </TableCell>
                                      <TableCell className="text-center">{product?.quantity}</TableCell>
                                      <TableCell className="text-right font-semibold">
                                        <FormattedPrice amount={product?.price * product?.quantity} />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="text-6xl mb-4">📦</span>
              <h2 className="text-xl font-bold text-accent mb-2">No Orders Yet</h2>
              <p className="text-sm text-lightText mb-6 max-w-sm">
                You haven&apos;t placed any orders yet. Start shopping to see your orders here.
              </p>
              <Link
                href="/shop"
                className="px-6 py-2.5 bg-lightOrange text-white font-bold rounded-xl hover:bg-darkOrange transition-colors text-sm"
              >
                Start Shopping →
              </Link>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={activePage <= 1}
                className={`px-4 py-2 border rounded-xl font-bold text-xs transition-all ${
                  activePage <= 1
                    ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500"
                    : "border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-accent dark:text-zinc-200"
                }`}
              >
                ← Previous
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1;
                const isActive = pNum === activePage;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setCurrentPage(pNum)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      isActive
                        ? "bg-lightOrange text-white border-lightOrange shadow-sm"
                        : "border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 text-accent dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={activePage >= totalPages}
                className={`px-4 py-2 border rounded-xl font-bold text-xs transition-all ${
                  activePage >= totalPages
                    ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500"
                    : "border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-accent dark:text-zinc-200"
                }`}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Recommended Products ── */}
      <div className="border-t border-gray-100 pt-10">
        <RecommendedProducts type="recommended" title="Recommended For You" />
      </div>
    </div>
  );
};

export default Orders;
