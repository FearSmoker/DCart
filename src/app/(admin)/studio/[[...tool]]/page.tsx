

import { NextStudio } from "next-sanity/studio";
import config from "../../../../../sanity.config";
import { auth } from "@/auth";
import AccessDenied from "@/components/AccessDenied";

export { metadata, viewport } from "next-sanity/studio";

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

  return <NextStudio config={config} />;
}
