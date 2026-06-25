import Link from "next/link";
import SearchInput from "./SearchInput";
import Logo from "./Logo";
import { getSession } from "@/lib/manageSession";
import { navBarList } from "@/constants";
import { MdFavoriteBorder, MdOutlineAdminPanelSettings } from "react-icons/md";
import MobileMenuButton from "./MobileMenuButton";
import ThemeToggle from "./ThemeToggle";

const Header = async () => {
  const session = await getSession();
  let isApprovedSeller = false;
  let isSeller = false;
  let isAdmin = false;
  if (session?.user?.email) {
    const defaultIsAdmin =
      session.user.email === process.env.ADMIN_EMAIL ||
      session.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    try {
      const { adminDB } = await import("@/firebaseAdmin");
      const userDoc = await adminDB.collection("users").doc(session.user.email).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        isAdmin = defaultIsAdmin || data?.role === "admin";
        isSeller = data?.role === "seller";
        isApprovedSeller = isSeller && data?.sellerStatus === "approved";
      } else {
        isAdmin = defaultIsAdmin;
      }

      // Track unique consumer visitors (not admin, not seller)
      if (!isAdmin && !isSeller) {
        const { redis } = await import("@/lib/redis");
        await redis.sadd("dcart:analytics:unique_consumers_set", session.user.email);
      }
    } catch (err) {
      console.warn("Failed to lookup user status in Header:", err);
      isAdmin = defaultIsAdmin;
    }
  }
  return (
    <header className="w-full h-20 bg-white dark:bg-zinc-900 border-b border-lightText/20 dark:border-zinc-800 sticky top-0 z-50 shadow-sm">
      <div className="h-full w-full px-4 sm:px-6 md:px-8 flex items-center justify-between gap-5 lg:gap-10">
        <Logo />
        <SearchInput />
        <div className="flex items-center gap-3 md:gap-5">
          <nav className="hidden md:flex items-center gap-5">
            {navBarList
              .filter((item) => !(isSeller && item.link === "/cart"))
              .map((item) => (
                <Link
                  key={item?.link}
                  href={item?.link}
                  className="text-sm font-semibold text-accent dark:text-zinc-200 hover:text-darkOrange dark:hover:text-lightOrange transition-colors duration-200 whitespace-nowrap"
                >
                  {item?.title}
                </Link>
              ))}
            {session?.user && !isSeller && (
              <Link
                href="/wishlist"
                className="relative p-2 rounded-xl hover:bg-orange-50 dark:hover:bg-zinc-800 transition-colors group"
                title="My Wishlist"
              >
                <MdFavoriteBorder className="text-xl text-accent dark:text-zinc-200 group-hover:text-orange-500 dark:group-hover:text-lightOrange transition-colors" />
              </Link>
            )}
            {session ? (
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-accent dark:text-zinc-200 hover:text-darkOrange dark:hover:text-lightOrange transition-colors duration-200"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/signin"
                className="text-sm font-bold px-4 py-2 bg-accent dark:bg-zinc-800 text-white dark:text-zinc-100 rounded-xl hover:bg-darkOrange dark:hover:bg-zinc-700 transition-colors duration-200"
              >
                Sign in
              </Link>
            )}
            {isAdmin && (
              <>
                <Link
                  href="/studio/security"
                  className="text-sm font-semibold text-accent dark:text-zinc-200 hover:text-darkOrange dark:hover:text-lightOrange transition-colors duration-200"
                >
                  Security
                </Link>
                <Link
                  href="/studio"
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-slate-800 dark:bg-zinc-800 text-white dark:text-zinc-200 rounded-xl hover:bg-slate-700 dark:hover:bg-zinc-700 transition-colors"
                >
                  <MdOutlineAdminPanelSettings className="text-sm" />
                  Admin
                </Link>
              </>
            )}
            {session?.user && !isSeller && (
              <Link
                href="/orders"
                className="text-sm font-semibold text-accent dark:text-zinc-200 hover:text-darkOrange dark:hover:text-lightOrange transition-colors duration-200"
              >
                Orders
              </Link>
            )}
            {isApprovedSeller && (
              <Link
                href="/vendor/dashboard"
                className="text-xs font-bold px-3 py-1.5 bg-emerald-600 dark:bg-emerald-700 text-white dark:text-emerald-100 rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors whitespace-nowrap"
              >
                Seller
              </Link>
            )}
          </nav>
          <ThemeToggle />
          <MobileMenuButton isSeller={isSeller} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
};

export default Header;
