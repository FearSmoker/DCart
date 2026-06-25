"use client";

import React, { useEffect, useState } from "react";
import { MdAutoAwesome, MdCheckCircle, MdCancel, MdInfo } from "react-icons/md";

interface AIReviewInsightsProps {
  productId: string;
}

interface AnalysisResult {
  sentiment: string;
  pros: string[];
  cons: string[];
}

const AIReviewInsights = ({ productId }: AIReviewInsightsProps) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/reviews/analyze?productId=${encodeURIComponent(productId)}`);
        const data = await res.json();
        if (data.success && data.analysis) {
          setAnalysis(data.analysis);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load review analysis:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [productId]);

  if (loading) {
    return (
      <div className="my-8 p-6 bg-white border border-gray-100 rounded-lg shadow-sm animate-pulse flex flex-col gap-4">
        <div className="h-6 w-48 bg-zinc-200 rounded" />
        <div className="h-4 w-32 bg-zinc-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="h-24 bg-zinc-100 rounded" />
          <div className="h-24 bg-zinc-100 rounded" />
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return null;
  }

  const { sentiment, pros, cons } = analysis;

  const isPositive = sentiment.toLowerCase() === "positive";
  const isNegative = sentiment.toLowerCase() === "negative";
  const sentimentClass = isPositive
    ? "bg-lightGreen/10 text-lightGreen border-lightGreen/20"
    : isNegative
    ? "bg-lightRed/10 text-lightRed border-lightRed/20"
    : "bg-gray-100 text-gray-500 border-gray-200";

  return (
    <div className="my-8 p-6 bg-white border border-gray-200/60 rounded-xl shadow-sm hover:shadow-md duration-300 transition-all text-left">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <MdAutoAwesome className="text-lightOrange text-2xl animate-pulse" />
          <h3 className="text-lg font-bold text-accent">
            AI Review Summary & Insights
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-lightText uppercase tracking-wider">
            Overall Sentiment:
          </span>
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${sentimentClass}`}>
            {sentiment}
          </span>
        </div>
      </div>

      {pros.length === 0 && cons.length === 0 ? (
        <div className="flex items-start gap-2 text-sm text-lightText italic bg-bgLight p-4 rounded-lg">
          <MdInfo className="text-lg text-lightOrange shrink-0 mt-0.5" />
          <p>
            Not enough aspect feedback (such as battery, screen, performance, or price details) has been written in reviews to generate pros/cons lists. Write a review to update these insights!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-lightGreen/5 rounded-lg border border-lightGreen/10">
            <div className="flex items-center gap-2 text-lightGreen font-bold text-sm mb-3">
              <MdCheckCircle className="text-lg" />
              <span>Pros & Strengths</span>
            </div>
            {pros.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {pros.map((pro, index) => (
                  <li
                    key={index}
                    className="px-3 py-1 bg-white text-xs font-semibold text-accent rounded-full border border-lightGreen/20 shadow-xs flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 bg-lightGreen rounded-full" />
                    {pro}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-lightText italic">
                No standout positive aspects extracted yet.
              </p>
            )}
          </div>

          <div className="p-4 bg-lightRed/5 rounded-lg border border-lightRed/10">
            <div className="flex items-center gap-2 text-lightRed font-bold text-sm mb-3">
              <MdCancel className="text-lg" />
              <span>Cons & Weaknesses</span>
            </div>
            {cons.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {cons.map((con, index) => (
                  <li
                    key={index}
                    className="px-3 py-1 bg-white text-xs font-semibold text-accent rounded-full border border-lightRed/20 shadow-xs flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 bg-lightRed rounded-full" />
                    {con}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-lightText italic">
                No standout weaknesses extracted yet.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 text-[10px] text-lightText/80 flex items-center gap-1">
        <MdInfo className="text-xs" />
        <span>Insights computed using aspect-based NLP analysis on user reviews.</span>
      </div>
    </div>
  );
};

export default AIReviewInsights;
