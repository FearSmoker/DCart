"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface SignUpFormProps {
  preSelectedRole?: "consumer" | "seller";
}

const SignUpForm = ({ preSelectedRole }: SignUpFormProps) => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState(preSelectedRole || "consumer");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirm) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sign up failed. Please try again.");
      } else {
        toast.success("Account created! Please sign in.");
        router.push("/signin");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide" htmlFor="signup-name">
          Full name
        </label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          className="w-full px-4 py-3 bg-white dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-700 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-all font-semibold"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide" htmlFor="signup-email">
          Email address
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 bg-white dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-700 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-all font-semibold"
          required
        />
      </div>

      {/* Only show role picker if no role was pre-selected */}
      {!preSelectedRole && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
            Account Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label
              className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-2xl cursor-pointer transition-all text-xs font-bold ${
                role === "consumer"
                  ? "border-accent bg-orange-50/20 dark:bg-zinc-800/40 text-accent dark:text-lightOrange"
                  : "border-gray-250 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-accent dark:text-zinc-300"
              }`}
            >
              <input
                type="radio"
                name="role"
                value="consumer"
                checked={role === "consumer"}
                onChange={() => setRole("consumer")}
                className="sr-only"
              />
              <span>Consumer</span>
            </label>
            <label
              className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-2xl cursor-pointer transition-all text-xs font-bold ${
                role === "seller"
                  ? "border-accent bg-orange-50/20 dark:bg-zinc-800/40 text-accent dark:text-lightOrange"
                  : "border-gray-250 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-accent dark:text-zinc-300"
              }`}
            >
              <input
                type="radio"
                name="role"
                value="seller"
                checked={role === "seller"}
                onChange={() => setRole("seller")}
                className="sr-only"
              />
              <span>Seller</span>
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide" htmlFor="signup-password">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 6 characters"
          className="w-full px-4 py-3 bg-white dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-700 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-all font-semibold"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide" htmlFor="signup-confirm">
          Confirm password
        </label>
        <input
          id="signup-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          className="w-full px-4 py-3 bg-white dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-700 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-all font-semibold"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent hover:bg-accent/90 dark:bg-zinc-100 dark:text-black dark:hover:bg-white text-white font-bold py-3 rounded-full transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2 text-xs uppercase tracking-wider shadow-xs"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
};

export default SignUpForm;

