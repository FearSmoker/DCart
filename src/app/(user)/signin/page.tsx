import { signIn } from "@/auth";
import Container from "@/components/Container";
import googleImage from "@/assets/googleImage.png";
import githubImage from "@/assets/githubImage.png";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/manageSession";
import SignInCredentialsForm from "@/components/SignInCredentialsForm";

interface SignInPageProps {
  searchParams: {
    error?: string;
  };
}

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const session = await getSession();
  if (session?.user) redirect("/");

  const error = searchParams?.error;

  return (
    <Container className="py-20 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-150/80 dark:border-zinc-800 p-10 rounded-3xl shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-300">
        {/* header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
            Welcome back
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-2 text-xs font-semibold">Sign in to your DCart account</p>
        </div>

        {error === "UserNotFound" && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl text-center text-xs font-bold text-red-700 dark:text-red-400 animate-pulse">
            Account not found. Please sign up first.
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="flex flex-col gap-3 mb-6">
          <form
            action={async () => {
              "use server";
              const { cookies } = await import("next/headers");
              cookies().set("dcart_auth_flow", "signin", { path: "/" });
              await signIn("google", { redirectTo: "/" }, { prompt: "select_account" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 border border-gray-250 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 font-bold py-3 rounded-full hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-all duration-200 shadow-xs text-xs uppercase tracking-wider"
            >
              <Image src={googleImage} alt="Google" className="w-4 h-4" />
              Continue with Google
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              const { cookies } = await import("next/headers");
              cookies().set("dcart_auth_flow", "signin", { path: "/" });
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 border border-zinc-700 dark:border-gray-250 bg-gray-900 dark:bg-zinc-100 text-white dark:text-black font-bold py-3 rounded-full hover:bg-gray-800 dark:hover:bg-white/90 transition-all duration-200 shadow-xs text-xs uppercase tracking-wider"
            >
              <Image src={githubImage} alt="GitHub" className="w-4 h-4 invert dark:invert-0" />
              Continue with GitHub
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-850" />
          <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-extrabold tracking-wider">OR SIGN IN WITH EMAIL</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-850" />
        </div>

        {/* Credentials Form */}
        <SignInCredentialsForm />

        {/* Sign Up Link */}
        <p className="text-center text-xs text-gray-500 dark:text-zinc-400 mt-6 font-semibold">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-orange-500 dark:text-lightOrange font-bold hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </Container>
  );
};

export default SignInPage;
