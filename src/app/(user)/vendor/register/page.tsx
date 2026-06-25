"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const CATEGORIES = [
  "Electronics", "Laptops", "Phones", "Audio", "Accessories",
  "Sports & Fitness", "Streetwear & Fashion", "Home & Decor", "Books", "Other"
];

interface FormData {
  name: string;
  email: string;
  storeName: string;
  storeDescription: string;
  phone: string;
  category: string;
  gstNumber: string;
  acceptTerms: boolean;
}

const COMMISSION_BY_CATEGORY: Record<string, number> = {
  "Electronics": 8, "Laptops": 8, "Phones": 10, "Audio": 12,
  "Accessories": 15, "Sports & Fitness": 10, "Streetwear & Fashion": 12,
  "Home & Decor": 10, "Books": 8, "Other": 10
};

export default function VendorRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ vendorId: string; commissionRate: number } | null>(null);

  const [form, setForm] = useState<FormData>({
    name: "", email: "", storeName: "", storeDescription: "",
    phone: "", category: "", gstNumber: "", acceptTerms: false,
  });

  const updateForm = (field: keyof FormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const estimatedCommission = form.category ? COMMISSION_BY_CATEGORY[form.category] || 10 : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.acceptTerms) { toast.error("Please accept the terms to continue."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email, storeName: form.storeName,
          storeDescription: form.storeDescription, phone: form.phone,
          category: form.category, gstNumber: form.gstNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess({ vendorId: data.vendor_id, commissionRate: data.commission_rate * 100 });
        toast.success("Vendor application submitted!");
      } else {
        toast.error(data.error || "Registration failed. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-accent mb-2">Application Submitted!</h2>
          <p className="text-lightText text-sm mb-4">
            Your vendor application is under review. We&apos;ll notify you within 1-2 business days.
          </p>
          <div className="bg-lightOrange/5 border border-lightOrange/20 rounded-xl p-4 mb-5 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-lightText">Vendor ID</span>
              <span className="font-bold text-accent text-xs">{success.vendorId.slice(-10)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-lightText">Commission Rate</span>
              <span className="font-bold text-darkOrange">{success.commissionRate}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-lightText">Status</span>
              <span className="font-bold text-amber-600">Pending Review</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-accent text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
          >
            Back to DCart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4 sm:px-6 md:px-8">
      <div className="w-full">
        {/* Header */}
        <div className="text-left mb-8">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-4">
            <span className="text-lightOrange text-sm font-bold">Multi-Vendor Marketplace</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Become a DCart Vendor</h1>
          <p className="text-white/60 text-sm max-w-md">
            Reach millions of customers. Set up your store, list products, and grow your business on DCart.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s === step ? "bg-lightOrange text-white scale-110" :
                s < step ? "bg-emerald-500 text-white" : "bg-white/10 text-white/40"
              }`}>
                {s < step ? "✓" : s}
              </div>
              {s < 3 && <div className={`h-0.5 w-12 rounded-full transition-all ${s < step ? "bg-emerald-500" : "bg-white/10"}`} />}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-5">

            {/* Step 1: Personal Info */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-accent">Personal Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-lightText uppercase tracking-wider block mb-1.5">Full Name *</label>
                    <input type="text" value={form.name} onChange={(e) => updateForm("name", e.target.value)} required
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-lightOrange focus:ring-2 focus:ring-lightOrange/10 transition-all" placeholder="Aryan Saxena" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-lightText uppercase tracking-wider block mb-1.5">Email *</label>
                    <input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} required
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-lightOrange focus:ring-2 focus:ring-lightOrange/10 transition-all" placeholder="aryan@example.com" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-lightText uppercase tracking-wider block mb-1.5">Phone Number</label>
                  <input type="tel" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-lightOrange focus:ring-2 focus:ring-lightOrange/10 transition-all" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-lightText uppercase tracking-wider block mb-1.5">GST Number (Optional)</label>
                  <input type="text" value={form.gstNumber} onChange={(e) => updateForm("gstNumber", e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-lightOrange focus:ring-2 focus:ring-lightOrange/10 transition-all" placeholder="22AAAAA0000A1Z5" />
                </div>
              </div>
            )}

            {/* Step 2: Store Info */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-accent">Store Information</h2>
                <div>
                  <label className="text-xs font-semibold text-lightText uppercase tracking-wider block mb-1.5">Store Name *</label>
                  <input type="text" value={form.storeName} onChange={(e) => updateForm("storeName", e.target.value)} required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-lightOrange focus:ring-2 focus:ring-lightOrange/10 transition-all" placeholder="TechZone Official" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-lightText uppercase tracking-wider block mb-1.5">Store Description</label>
                  <textarea value={form.storeDescription} onChange={(e) => updateForm("storeDescription", e.target.value)} rows={3}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-lightOrange focus:ring-2 focus:ring-lightOrange/10 transition-all resize-none"
                    placeholder="Tell customers about your store and products..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-lightText uppercase tracking-wider block mb-1.5">Primary Category *</label>
                  <select value={form.category} onChange={(e) => updateForm("category", e.target.value)} required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-lightOrange focus:ring-2 focus:ring-lightOrange/10 transition-all bg-white">
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Commission preview */}
                {estimatedCommission && (
                  <div className="bg-lightOrange/5 border border-lightOrange/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-accent">Platform Commission</p>
                        <p className="text-xs text-lightText mt-0.5">DCart retains this % from each sale in {form.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-darkOrange">{estimatedCommission}%</p>
                        <p className="text-[10px] text-lightText">per transaction</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-accent">Review & Submit</h2>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  {[
                    { label: "Name", value: form.name },
                    { label: "Email", value: form.email },
                    { label: "Store", value: form.storeName },
                    { label: "Category", value: form.category },
                    { label: "Commission Rate", value: `${estimatedCommission}%` },
                    ...(form.gstNumber ? [{ label: "GST Number", value: form.gstNumber }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-lightText">{label}</span>
                      <span className="font-semibold text-accent">{value}</span>
                    </div>
                  ))}
                </div>

                {/* What you get */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-accent uppercase tracking-wider">What you get</p>
                  {[
                    "Vendor Dashboard — manage products & orders",
                    "Real-time analytics — revenue, commissions, trends",
                    "AI-powered insights — demand forecasting & pricing",
                    "Automated payouts — weekly direct bank transfers",
                    "Your own store page on DCart marketplace",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-gray-700">{item}</div>
                  ))}
                </div>

                {/* Terms */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.acceptTerms}
                    onChange={(e) => updateForm("acceptTerms", e.target.checked)}
                    className="mt-0.5 accent-lightOrange"
                  />
                  <span className="text-xs text-lightText leading-relaxed">
                    I agree to the DCart Vendor Terms & Conditions, including the commission structure for my product category.
                  </span>
                </label>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <button type="button" onClick={() => setStep(s => s - 1)}
                  className="flex-1 py-3 border border-gray-200 text-accent font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  ← Back
                </button>
              )}
              {step < 3 ? (
                <button type="button" onClick={() => setStep(s => s + 1)}
                  disabled={
                    (step === 1 && (!form.name || !form.email)) ||
                    (step === 2 && (!form.storeName || !form.category))
                  }
                  className="flex-1 py-3 bg-accent text-white font-bold rounded-xl hover:bg-slate-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  Continue →
                </button>
              ) : (
                <button type="submit" disabled={loading || !form.acceptTerms}
                  className="flex-1 py-3 bg-lightOrange text-white font-bold rounded-xl hover:bg-darkOrange transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting…</>
                  ) : "Submit Application"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
