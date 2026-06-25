"use client";

import React, { useEffect, useState } from "react";

interface DynamicPriceData {
  adjusted_price: number;
  rule: string;
  badge: string | null;
  badge_color: string | null;
  multiplier: number;
  demand_score?: number;
}

const BADGE_STYLES: Record<string, string> = {
  red: "bg-red-50 text-red-600 border border-red-200",
  orange: "bg-orange-50 text-orange-600 border border-orange-200",
  green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  purple: "bg-purple-50 text-purple-600 border border-purple-200 animate-pulse",
};

interface DynamicPriceBadgeProps {
  productId: string;
  basePrice: number;
  prefetchedData?: DynamicPriceData | null; // skip re-fetch if already loaded

  className?: string;
}

const DynamicPriceBadge = ({
  productId,
  basePrice,
  prefetchedData,
  className = "",
}: DynamicPriceBadgeProps) => {
  const [data, setData] = useState<DynamicPriceData | null>(
    prefetchedData !== null && prefetchedData !== undefined ? prefetchedData : null
  );
  const [loading, setLoading] = useState(!prefetchedData);

  useEffect(() => {
    if (prefetchedData) {
      setData(prefetchedData);
      return;
    }
    let cancelled = false;
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `/api/pricing/dynamic?product_id=${encodeURIComponent(productId)}`
        );
        const json = await res.json();
        if (!cancelled && json.success) {
          setData({
            adjusted_price: json.adjusted_price !== null && json.adjusted_price !== undefined ? json.adjusted_price : basePrice,
            rule: json.rule !== null && json.rule !== undefined ? json.rule : "base",
            badge: json.badge !== null && json.badge !== undefined ? json.badge : null,
            badge_color: json.badge_color !== null && json.badge_color !== undefined ? json.badge_color : null,
            multiplier: json.multiplier !== null && json.multiplier !== undefined ? json.multiplier : 1.0,
            demand_score: json.demand_score,
          });
        }
      } catch (e) {
        // Keep base price if API fails
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPrice();
    return () => {
      cancelled = true;
    };
  }, [productId, basePrice, prefetchedData]);

  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.rule === "base" || !data.badge) {
    return null; // No badge for regular pricing
  }

  const badgeStyle =
    BADGE_STYLES[data.badge_color !== null && data.badge_color !== undefined ? data.badge_color : "orange"] ||
    BADGE_STYLES.orange;

  const isSurge = ["surge", "demand_surge_mild"].includes(data.rule);

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeStyle}`}
      >
        {data.badge}
      </span>
      {data.adjusted_price !== basePrice && (
        <span
          className={`text-[10px] font-semibold ${
            isSurge ? "text-red-500" : "text-emerald-600"
          }`}
        >
          {isSurge ? "↑" : "↓"} ₹{data.adjusted_price.toLocaleString("en-IN")}
        </span>
      )}
    </div>
  );
};

export default DynamicPriceBadge;