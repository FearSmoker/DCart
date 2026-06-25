import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const publicRoutes = [
  "/",
  "/signin",
  "/signup",
  "/shop",
  "/product",
  "/search",
  "/api/auth",
  "/api/recommendations",
  "/api/socket",
  "/favicon.ico",
  "/studio",
  "/unauthorized",
];

export default auth((req: NextRequest & { auth: any }) => {
  const { pathname } = req.nextUrl;
  
  const role = req.auth?.user?.role;

  // If user has onboarding role, force redirect to complete-profile page (unless already on it or hitting auth APIs)
  if (role === "onboarding" && pathname !== "/complete-profile" && !pathname.startsWith("/api/auth")) {
    return NextResponse.redirect(new URL("/complete-profile", req.url));
  }

  // If user does not need onboarding, prevent accessing the complete-profile page
  if (role && role !== "onboarding" && pathname === "/complete-profile") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/") || pathname.startsWith(route + "?")
  );
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const callbackUrl = pathname + req.nextUrl.search;
    return NextResponse.redirect(
      new URL(`/unauthorized?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.url)
    );
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
