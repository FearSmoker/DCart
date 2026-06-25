import { signIn } from "@/auth";
import Container from "@/components/Container";
import SignUpForm from "@/components/SignUpForm";
import SignUpRoleSelector from "@/components/SignUpRoleSelector";
import googleImage from "@/assets/googleImage.png";
import githubImage from "@/assets/githubImage.png";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/manageSession";

interface SignUpPageProps {
  searchParams: {
    error?: string;
    step?: string;
    role?: string;
  };
}

const SignUpPage = async ({ searchParams }: SignUpPageProps) => {
  const session = await getSession();
  if (session?.user) redirect("/");

  const error = searchParams?.error;
  const step = searchParams?.step;
  const role = searchParams?.role;

  // ── step 1: role selection ──────────────────────────────────────────
  if (step !== "register" || (role !== "consumer" && role !== "seller")) {
    return (
      <Container className="py-20 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-150/80 dark:border-zinc-800 p-10 rounded-3xl shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-300">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
              Join DCart
            </h1>
            <p className="text-gray-500 dark:text-zinc-400 mt-2 text-xs font-semibold">
              Choose how you&apos;d like to use DCart
            </p>
          </div>

          {error === "AlreadyRegistered" && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-center text-xs font-bold text-amber-700 dark:text-amber-400 animate-pulse">
              This account is already registered. Please sign in instead.
            </div>
          )}

          <SignUpRoleSelector />

          <p className="text-center text-xs text-gray-500 dark:text-zinc-400 mt-6 font-semibold">
            Already have an account?{" "}
            <Link
              href="/signin"
              className="text-orange-500 dark:text-lightOrange font-bold hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </Container>
    );
  }

  // ── Step 2: Actual signup form ──────────────────────────────────────
  return (
    <Container className="py-20 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-150/80 dark:border-zinc-800 p-10 rounded-3xl shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-300">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-full px-4 py-1.5 mb-4">
            <span className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
              {role === "seller" ? "🏪 Seller Account" : "🛒 Consumer Account"}
            </span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
            Create account
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-2 text-xs font-semibold">
            Sign up to get started as a {role}
          </p>
        </div>

        {error === "AlreadyRegistered" && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-center text-xs font-bold text-amber-700 dark:text-amber-400 animate-pulse">
            This account is already registered. Please sign in instead.
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="flex flex-col gap-3 mb-6">
          <form
            action={async () => {
              "use server";
              const { cookies } = await import("next/headers");
              cookies().set("dcart_auth_flow", "signup", { path: "/", maxAge: 600 });
              cookies().set("dcart_signup_role", role!, { path: "/", maxAge: 600 });
              await signIn("google", { redirectTo: "/" }, { prompt: "select_account" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 border border-gray-255 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 font-bold py-3 rounded-full hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-all duration-200 shadow-xs text-xs uppercase tracking-wider"
            >
              <Image src={googleImage} alt="Google" className="w-4 h-4" />
              Sign up with Google
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              const { cookies } = await import("next/headers");
              cookies().set("dcart_auth_flow", "signup", { path: "/", maxAge: 600 });
              cookies().set("dcart_signup_role", role!, { path: "/", maxAge: 600 });
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 border border-zinc-700 dark:border-gray-250 bg-gray-900 dark:bg-zinc-100 text-white dark:text-black font-bold py-3 rounded-full hover:bg-gray-800 dark:hover:bg-white/90 transition-all duration-200 shadow-xs text-xs uppercase tracking-wider"
            >
              <Image src={githubImage} alt="GitHub" className="w-4 h-4 invert dark:invert-0" />
              Sign up with GitHub
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-850" />
          <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-extrabold tracking-wider">OR SIGN UP WITH EMAIL</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-850" />
        </div>

        {/* Sign Up Form - role is pre-selected from URL, no need for role picker */}
        <SignUpForm preSelectedRole={role as "consumer" | "seller"} />

        {/* Footer links */}
        <div className="flex items-center justify-between mt-6">
          <Link
            href="/signup"
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors font-semibold"
          >
            ← Change role
          </Link>
          <Link
            href="/signin"
            className="text-xs text-orange-500 dark:text-lightOrange font-bold hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </Container>
  );
};

export default SignUpPage;
