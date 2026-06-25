"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const SignInCredentialsForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Invalid email or password. Please try again.");
      } else {
        toast.success("Signed in successfully!");
        router.push("/");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignIn} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide" htmlFor="signin-email">
          Email address
        </label>
        <input
          id="signin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 bg-white dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-700 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-all font-semibold"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide" htmlFor="signin-password">
          Password
        </label>
        <input
          id="signin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-3 bg-white dark:bg-zinc-800/40 border border-gray-250 dark:border-zinc-700 rounded-2xl text-xs text-accent dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-all font-semibold"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent hover:bg-accent/90 dark:bg-zinc-100 dark:text-black dark:hover:bg-white text-white font-bold py-3 rounded-full transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2 text-xs uppercase tracking-wider shadow-xs"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
};

export default SignInCredentialsForm;
