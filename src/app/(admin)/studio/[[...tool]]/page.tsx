// Prevent Next.js from statically rendering this page at build time.
export const dynamic = "force-dynamic";

// Define metadata inline — never re-export from next-sanity/studio at module
// level, as that initialises Sanity Studio (including createContext) during build.
export const metadata = {
  title: "DCart Studio",
  description: "DCart Sanity Content Studio",
};

import nextDynamic from "next/dynamic";
import { auth } from "@/auth";
import AccessDenied from "@/components/AccessDenied";

// Load StudioClient with ssr:false so the entire sanity/studio configuration
// and bundle are NEVER imported/evaluated on the server.
const StudioClient = nextDynamic(
  () => import("./StudioClient"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
        <p className="text-zinc-500 dark:text-zinc-400">Loading studio…</p>
      </div>
    ),
  }
);

export default async function StudioPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
        <AccessDenied
          message="Access is denied to view the page. Sign in first."
          buttonText="Sign In"
          buttonHref={`/signin?callbackUrl=${encodeURIComponent("/studio")}`}
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
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
        <AccessDenied message="You do not have the authority to access this page. Only administrators are allowed." />
      </div>
    );
  }

  return <StudioClient />;
}
