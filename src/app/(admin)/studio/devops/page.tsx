import Link from "next/link";
import { auth } from "@/auth";
import DevOpsDashboard from "@/components/DevOpsDashboard";
import ThemeToggle from "@/components/ThemeToggle";
import AccessDenied from "@/components/AccessDenied";

export const metadata = {
  title: "DevOps Monitoring — DCart Admin",
  description: "Infrastructure monitoring, CI/CD pipelines, service health, and Prometheus metrics for DCart platform.",
};

export default async function DevOpsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <AccessDenied
          message="Access is denied to view the page. Sign in first."
          buttonText="Sign In"
          buttonHref={`/signin?callbackUrl=${encodeURIComponent("/studio/devops")}`}
        />
      </div>
    );
  }

  const role = (session.user as { role?: string }).role;
  const isAdmin =
    role === "admin" ||
    session?.user?.email === process.env.ADMIN_EMAIL ||
    session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <AccessDenied message="You do not have the authority to access this page. Only administrators are allowed." />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-4 mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-lightText hover:text-accent dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors duration-200"
        >
          ← Go back to Admin Dashboard
        </Link>
        <ThemeToggle />
      </div>
      <DevOpsDashboard />
    </div>
  );
}
