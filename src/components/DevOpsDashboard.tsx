"use client";

import React, { useState, useCallback } from "react";


interface ServiceInfo {
  name: string;
  icon: string;
  port: string;
  status: "Running" | "Healthy" | "External" | "Stopped";
  uptime: string;
  cpu: number;
  memory: number;
}

interface PipelineRun {
  id: string;
  branch: string;
  commit: string;
  timestamp: string;
  steps: { name: string; status: "passed" | "failed" | "running" | "pending" }[];
  duration: string;
}

interface DockerService {
  name: string;
  image: string;
  ports: string;
  status: string;
  size: string;
}

// simulated static data
const SERVICES: ServiceInfo[] = [
  { name: "Nginx Gateway", icon: "", port: "80", status: "Running", uptime: "14d 6h 32m", cpu: 2.1, memory: 64 },
  { name: "Next.js Frontend", icon: "", port: "3000", status: "Running", uptime: "14d 6h 30m", cpu: 18.4, memory: 312 },
  { name: "AI Service (FastAPI)", icon: "", port: "8000", status: "Healthy", uptime: "14d 6h 28m", cpu: 34.7, memory: 540 },
  { name: "Redis Cache", icon: "", port: "6379", status: "Running", uptime: "14d 6h 32m", cpu: 1.8, memory: 128 },
  { name: "Prometheus", icon: "", port: "9090", status: "Running", uptime: "14d 6h 25m", cpu: 5.3, memory: 196 },
  { name: "Grafana", icon: "", port: "3001", status: "Healthy", uptime: "14d 6h 22m", cpu: 3.9, memory: 180 },
  { name: "Cloudinary CDN", icon: "", port: "External", status: "External", uptime: "99.99% SLA", cpu: 0, memory: 0 },
];

const DOCKER_SERVICES: DockerService[] = [
  { name: "dcart-nginx", image: "nginx:alpine", ports: "80:80, 443:443", status: "Up 14 days", size: "23.4 MB" },
  { name: "dcart-frontend", image: "node:20-alpine", ports: "3000:3000", status: "Up 14 days", size: "412 MB" },
  { name: "dcart-ai", image: "python:3.11-slim", ports: "8000:8000", status: "Up 14 days", size: "687 MB" },
  { name: "dcart-redis", image: "redis:7-alpine", ports: "6379:6379", status: "Up 14 days", size: "32.1 MB" },
  { name: "dcart-prometheus", image: "prom/prometheus:latest", ports: "9090:9090", status: "Up 14 days", size: "245 MB" },
  { name: "dcart-grafana", image: "grafana/grafana:latest", ports: "3001:3000", status: "Up 14 days", size: "392 MB" },
];

const PIPELINE_RUNS: PipelineRun[] = [
  {
    id: "Run #487", branch: "main", commit: "a3f9c21", timestamp: "2 mins ago", duration: "3m 42s",
    steps: [
      { name: "Lint", status: "passed" }, { name: "TypeCheck", status: "passed" },
      { name: "Build", status: "passed" }, { name: "Docker Build", status: "passed" },
      { name: "Deploy", status: "passed" },
    ],
  },
  {
    id: "Run #486", branch: "main", commit: "e1b7d04", timestamp: "1 hour ago", duration: "4m 11s",
    steps: [
      { name: "Lint", status: "passed" }, { name: "TypeCheck", status: "passed" },
      { name: "Build", status: "passed" }, { name: "Docker Build", status: "passed" },
      { name: "Deploy", status: "passed" },
    ],
  },
  {
    id: "Run #485", branch: "feat/devops", commit: "7c2fa98", timestamp: "3 hours ago", duration: "3m 58s",
    steps: [
      { name: "Lint", status: "passed" }, { name: "TypeCheck", status: "failed" },
      { name: "Build", status: "pending" }, { name: "Docker Build", status: "pending" },
      { name: "Deploy", status: "pending" },
    ],
  },
  {
    id: "Run #484", branch: "main", commit: "b4e6a12", timestamp: "6 hours ago", duration: "3m 29s",
    steps: [
      { name: "Lint", status: "passed" }, { name: "TypeCheck", status: "passed" },
      { name: "Build", status: "passed" }, { name: "Docker Build", status: "passed" },
      { name: "Deploy", status: "passed" },
    ],
  },
  {
    id: "Run #483", branch: "fix/redis-cache", commit: "d09e3f1", timestamp: "12 hours ago", duration: "5m 02s",
    steps: [
      { name: "Lint", status: "passed" }, { name: "TypeCheck", status: "passed" },
      { name: "Build", status: "passed" }, { name: "Docker Build", status: "failed" },
      { name: "Deploy", status: "pending" },
    ],
  },
];

// 24 data points for the past 24 hours
const generateMetrics = (base: number, variance: number) =>
  Array.from({ length: 24 }, () => Math.max(0, base + (Math.random() - 0.5) * variance * 2));

const REQUEST_RATE = generateMetrics(1200, 400);
const ERROR_RATE = generateMetrics(2.5, 2);
const RESPONSE_TIME = generateMetrics(85, 35);


const SparklineChart = ({
  data, color, label, unit, height = 80,
}: {
  data: number[]; color: string; label: string; unit: string; height?: number;
}) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  const w = 300;
  const h = height;
  const padding = 4;

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * (w - padding * 2);
      const y = h - padding - ((val - min) / (max - min || 1)) * (h - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${padding},${h - padding} ${points} ${w - padding},${h - padding}`;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-accent uppercase tracking-wide">{label}</h4>
        <span className="text-[10px] bg-gray-50 text-lightText px-2 py-0.5 rounded-full font-medium">
          Avg: {avg.toFixed(1)} {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: `${height}px` }}>
        {[0.25, 0.5, 0.75].map((pct) => (
          <line key={pct} x1={padding} y1={padding + pct * (h - padding * 2)} x2={w - padding} y2={padding + pct * (h - padding * 2)} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        <polygon points={areaPoints} fill={color} opacity="0.08" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* latest point */}
        {(() => {
          const lastX = padding + ((data.length - 1) / (data.length - 1)) * (w - padding * 2);
          const lastY = h - padding - ((data[data.length - 1] - min) / (max - min || 1)) * (h - padding * 2);
          return <circle cx={lastX} cy={lastY} r="4" fill={color} className="animate-pulse" />;
        })()}
      </svg>
      <div className="flex justify-between mt-2 text-[9px] text-lightText/60">
        <span>24h ago</span>
        <span>Now</span>
      </div>
    </div>
  );
};


const CircularGauge = ({ value, label, icon, unit, maxVal = 100 }: { value: number; label: string; icon: string; unit: string; maxVal?: number; }) => {
  const pct = Math.min((value / maxVal) * 100, 100);
  const radius = 42;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  let trackColor = "stroke-emerald-500";
  let textColor = "text-emerald-600";
  if (pct >= 80) { trackColor = "stroke-red-500"; textColor = "text-red-600"; }
  else if (pct >= 60) { trackColor = "stroke-amber-500"; textColor = "text-amber-600"; }

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90 group-hover:scale-105 transition-transform duration-300">
          <circle className="stroke-gray-100 fill-transparent" strokeWidth={strokeWidth} r={normalizedRadius} cx={radius} cy={radius} />
          <circle className={`${trackColor} fill-transparent transition-all duration-1000 ease-out`} strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} style={{ strokeDashoffset }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg">{icon}</span>
          <span className={`text-sm font-black ${textColor}`}>{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-accent">{label}</p>
        <p className="text-[10px] text-lightText">{value}{unit} used</p>
      </div>
    </div>
  );
};


const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Running: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Healthy: "bg-blue-50 text-blue-700 border-blue-200",
    External: "bg-purple-50 text-purple-700 border-purple-200",
    Stopped: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[status] || styles.Running}`}>
      {(status === "Running" || status === "Healthy") && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      )}
      {status}
    </span>
  );
};


const PipelineStepBadge = ({ step }: { step: { name: string; status: string } }) => {
  const styles: Record<string, string> = {
    passed: "bg-emerald-50 border-emerald-200 text-emerald-700",
    failed: "bg-red-50 border-red-200 text-red-700",
    running: "bg-amber-50 border-amber-200 text-amber-700",
    pending: "bg-gray-50 border-gray-200 text-gray-400",
  };
  const icons: Record<string, string> = { passed: "✓", failed: "✕", running: "⟳", pending: "○" };
  return (
    <div className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border text-center min-w-[72px] transition-all duration-200 hover:scale-105 ${styles[step.status]}`}>
      <span className="text-sm font-black">{icons[step.status]}</span>
      <span className="text-[10px] font-bold leading-tight">{step.name}</span>
    </div>
  );
};


const ProgressBar = ({ value, max, color, label }: { value: number; max: number; color: string; label: string }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-accent">{label}</span>
        <span className="text-[10px] font-bold text-lightText">{value.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};


const DevOpsDashboard = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "pipeline" | "metrics">("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshKey((k) => k + 1);
      setRefreshing(false);
    }, 1200);
  }, []);

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Header, Tabs, and Tab Panels rendered here */}
    </div>
  );
};

export default DevOpsDashboard;