import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          // Verify against our signup API
          const res = await fetch(
            `${process.env.NEXT_AUTH_URL || "http://localhost:3000"}/api/auth/verify`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            }
          );
          if (!res.ok) return null;
          const user = await res.json();
          return user ?? null;
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/signin",
    newUser: "/signup",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "github") {
        const email = user.email;
        if (!email) return false;

        // ── Read flow & role cookies from raw header (safer than cookies()) ──
        let flow = "signin"; // default: treat as sign-in (blocks unknown users)
        let signupRole = "consumer";
        try {
          const { headers } = await import("next/headers");
          const headersList = headers();
          const cookieHeader = headersList.get("cookie") || "";

          const flowMatch = cookieHeader.match(/dcart_auth_flow=([^;\s]+)/);
          if (flowMatch) {
            const rawFlow = flowMatch[1].trim();
            // Only allow known safe flow values — reject anything else
            if (rawFlow === "signup" || rawFlow === "signin") {
              flow = rawFlow;
            }
          }

          const roleMatch = cookieHeader.match(/dcart_signup_role=([^;\s]+)/);
          if (roleMatch) {
            const rawRole = roleMatch[1].trim();
            // Strictly whitelist: only consumer or seller allowed
            if (rawRole === "consumer" || rawRole === "seller") {
              signupRole = rawRole;
            }
          }
        } catch (e) {
          console.warn("[auth] Could not read cookies in signIn callback:", e);
          // Defaults to signin flow — blocks unknown users
        }

        const { adminDB } = await import("@/firebaseAdmin");
        const userDoc = await adminDB.collection("users").doc(email).get();
        const userExists = userDoc.exists;

        // ── SIGN-IN flow: user MUST already exist and be fully registered ──
        if (flow === "signin") {
          if (!userExists) {
            return "/signin?error=UserNotFound";
          }
          const userData = userDoc.data();
          if (userData?.role === "onboarding") {
            // Stuck in onboarding — clean up and block
            await adminDB.collection("users").doc(email).delete();
            return "/signin?error=UserNotFound";
          }
          // Fully registered user — allow sign-in
          return true;
        }

        // ── SIGN-UP flow: create new account with the selected role ──
        if (flow === "signup") {
          if (userExists) {
            const userData = userDoc.data();
            if (userData?.role !== "onboarding") {
              // Already fully registered — redirect to sign in
              return "/signup?error=AlreadyRegistered";
            }
            // Stuck in onboarding — update with the selected role
            const resolvedRole = signupRole === "seller" ? "seller" : "consumer";
            await adminDB.collection("users").doc(email).update({
              role: resolvedRole,
              sellerStatus: resolvedRole === "seller" ? "pending" : null,
              updatedAt: new Date().toISOString(),
            });
            return true;
          }

          // Brand new user — create with the role they chose on the signup page
          const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;
          const isAdmin = adminEmail ? email === adminEmail : false;
          const resolvedRole = isAdmin
            ? "admin"
            : signupRole === "seller"
              ? "seller"
              : "consumer";
          await adminDB.collection("users").doc(email).set({
            name: user.name || "OAuth User",
            email: email,
            createdAt: new Date().toISOString(),
            provider: account.provider,
            role: resolvedRole,
            sellerStatus: resolvedRole === "seller" ? "pending" : null,
          });
          return true;
        }

        // Unknown flow value — reject for safety
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        // @ts-ignore
        token.role = user.role || "consumer";
        // @ts-ignore
        token.sellerStatus = user.sellerStatus || null;
        // @ts-ignore
        token.vendorId = user.vendorId || null;
      }

      // Read role dynamically from Firestore if running in Node.js environment
      if (process.env.NEXT_RUNTIME !== "edge" && token.email) {
        try {
          const { adminDB } = await import("@/firebaseAdmin");
          const userDoc = await adminDB
            .collection("users")
            .doc(token.email as string)
            .get();
          if (userDoc.exists) {
            const data = userDoc.data();
            // @ts-ignore
            token.role = data?.role || "consumer";
            // @ts-ignore
            token.sellerStatus = data?.sellerStatus || null;
            // @ts-ignore
            token.vendorId = data?.vendorId || null;
          }
        } catch (err) {
          console.warn(
            "Skipping dynamic Firestore role lookup in NextAuth jwt callback:",
            err
          );
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        // @ts-ignore
        session.user.role = token.role as string;
        // @ts-ignore
        session.user.sellerStatus = token.sellerStatus as string;
        // @ts-ignore
        session.user.vendorId = token.vendorId as string;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET!,
  trustHost: true,
});
