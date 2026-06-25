"use client";

import React, { useState, useEffect } from "react";

interface AuditLog {
  id: string;
  timestamp: string;
  amount: number;
  location: string;
  device: string;
  frequency: number;
  probability: number;
  riskLevel: "High" | "Medium" | "Low";
}

// ─── Feature Importances Chart ────────────────────────────────────────────
const FeatureImportanceChart = () => {
  const data = [
    { label: "Device Integrity", value: 0.3211, color: "bg-purple-500" },
    { label: "Order Frequency", value: 0.2992, color: "bg-blue-500" },
    { label: "Order Amount", value: 0.2658, color: "bg-orange-500" },
    { label: "Location Risk", value: 0.1139, color: "bg-teal-500" },
  ];

  const maxVal = 0.3211;

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = (item.value / maxVal) * 100;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-lightText font-semibold w-28 truncate">{item.label}</span>
            <div className="flex-1 bg-gray-100 h-3 rounded-full overflow-hidden">
              <div
                className={`${item.color} h-full rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-accent w-10 text-right">
              {Math.round(item.value * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const FraudSecurityDashboard = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const fetchThreatLogs = async () => {
      try {
        const response = await fetch("/api/security/threat-logs");
        const data = await response.json();
        if (data.success && data.logs) {
          setLogs(data.logs);
        }
      } catch (err) {
        console.error("Failed to fetch threat logs:", err);
      }
    };
    fetchThreatLogs();
  }, []);

  const scannedOrdersCount = logs.length;
  const highRiskCount = logs.filter((log) => log.riskLevel === "High").length;
  const fraudRatePct = scannedOrdersCount > 0 ? ((highRiskCount / scannedOrdersCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-accent">Security Intelligence Center</h2>
          <p className="text-sm text-lightText mt-0.5">
            Real-time transaction risk monitoring and fraud prevention
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-start">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
            Protection Active
          </span>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center text-gray-400 mb-1.5 text-xs font-bold uppercase tracking-wide">
            <span>Scanned Orders</span>
            <span></span>
          </div>
          <p className="text-2xl font-black text-accent">{scannedOrdersCount}</p>
          <p className="text-[10px] text-lightText mt-0.5">Last 30 days active checks</p>
        </div>

        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center text-gray-400 mb-1.5 text-xs font-bold uppercase tracking-wide">
            <span>High Risk Flags</span>
            <span></span>
          </div>
          <p className="text-2xl font-black text-red-500">{highRiskCount}</p>
          <p className="text-[10px] text-red-600/80 mt-0.5">{fraudRatePct}% overall fraud rate</p>
        </div>

        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center text-gray-400 mb-1.5 text-xs font-bold uppercase tracking-wide">
            <span>Model Accuracy</span>
            <span></span>
          </div>
          <p className="text-2xl font-black text-accent">98.4%</p>
          <p className="text-[10px] text-lightText mt-0.5">Risk model accuracy</p>
        </div>

        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center text-gray-400 mb-1.5 text-xs font-bold uppercase tracking-wide">
            <span>F1-Score</span>
            <span></span>
          </div>
          <p className="text-2xl font-black text-accent">96.2%</p>
          <p className="text-[10px] text-lightText mt-0.5">Classification metric</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Audit Log */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-gray-50 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-accent">Real-Time Risk Audit Log</h3>
                <p className="text-xs text-lightText mt-0.5">
                  Audit trail of recent transactions analyzed by the risk assessment model
                </p>
              </div>
              <span className="text-[10px] bg-red-50 text-red-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live Sniffer
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-lightText">
                    <th className="py-2.5 pr-2">TX ID</th>
                    <th className="py-2.5 px-2">Amount</th>
                    <th className="py-2.5 px-2">Location</th>
                    <th className="py-2.5 px-2">Device</th>
                    <th className="py-2.5 px-2">Frequency</th>
                    <th className="py-2.5 px-2 text-right">Risk Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-lightText font-semibold text-xs">
                        No threat logs registered. System secure.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        className="text-xs hover:bg-gray-50/70 transition-colors"
                      >
                        <td className="py-3 pr-2 font-semibold text-accent">
                          {log.id}
                          <span className="block text-[9px] font-medium text-lightText/60 font-mono mt-0.5">
                            {log.timestamp}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-bold text-accent">₹{log.amount.toLocaleString()}</td>
                        <td className="py-3 px-2 text-lightText font-medium">{log.location}</td>
                        <td className="py-3 px-2 text-lightText font-mono text-[11px]">{log.device}</td>
                        <td className="py-3 px-2 text-lightText text-center font-medium">{log.frequency} tx/2m</td>
                        <td className="py-3 px-2 text-right">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              log.riskLevel === "High"
                                ? "bg-red-50 text-red-600 border-red-100"
                                : log.riskLevel === "Medium"
                                  ? "bg-amber-50 text-amber-600 border-amber-100"
                                  : "bg-emerald-50 text-emerald-600 border-emerald-100"
                            }`}
                          >
                            {Math.round(log.probability * 100)}% {log.riskLevel}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: Feature Importance & Info */}
        <div className="lg:col-span-4 space-y-6">
          {/* Feature Importance Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-extrabold text-base text-accent">Risk Factor Analysis</h3>
              <p className="text-xs text-lightText mt-0.5">
                Relative feature importances derived from gini gain splitting across decision trees
              </p>
            </div>
            
            <FeatureImportanceChart />

            <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-100 p-3.5 rounded-xl text-xs space-y-1">
              <p className="font-bold text-accent">Risk Assessment Model</p>
              <p className="text-lightText leading-relaxed">
                The transaction scoring model runs automated real-time checks on user orders to compute threat levels based on frequency, device metadata, order value, and geographical anomalies.
              </p>
            </div>
          </div>

          {/* Security Rules Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="font-extrabold text-base text-accent">Risk Rules Engine</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs">
                <span className="text-red-500 shrink-0"></span>
                <div>
                  <p className="font-bold text-accent">High Frequency Flag</p>
                  <p className="text-lightText mt-0.5">Orders exceeding 5 transactions per 2 minutes (6 unique orders) are automatically flagged as High Risk.</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs pt-2.5 border-t border-gray-50">
                <span className="text-amber-500 shrink-0"></span>
                <div>
                  <p className="font-bold text-accent">Quantity Limit Flag</p>
                  <p className="text-lightText mt-0.5">Orders containing multiple products with total items quantity &gt; 10, or a single product with quantity &gt; 6 are automatically flagged as High Risk.</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs pt-2.5 border-t border-gray-50">
                <span className="text-emerald-500 shrink-0"></span>
                <div>
                  <p className="font-bold text-accent">Device & IP Integrity</p>
                  <p className="text-lightText mt-0.5">Device user-agents and network interfaces are analyzed to detect automated scripts or botanical behavior.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FraudSecurityDashboard;