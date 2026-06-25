// validates required env vars at startup; throws on missing critical ones

interface EnvCheck {
  key: string;
  critical: boolean;
  description: string;
}

const REQUIRED_ENV_VARS: EnvCheck[] = [
  // auth
  {
    key: "AUTH_SECRET",
    critical: true,
    description: "NextAuth JWT signing secret",
  },
  {
    key: "ADMIN_EMAIL",
    critical: true,
    description: "Admin account email",
  },
  // oauth
  {
    key: "AUTH_GOOGLE_ID",
    critical: false,
    description: "Google OAuth client ID",
  },
  {
    key: "AUTH_GOOGLE_SECRET",
    critical: false,
    description: "Google OAuth client secret",
  },
  // stripe
  {
    key: "STRIPE_SECRET_KEY",
    critical: true,
    description: "Stripe secret key",
  },
  // firebase
  {
    key: "FIREBASE_SERVICE_ACCOUNT_KEY",
    critical: true,
    description: "Firebase Admin service account",
  },
  // redis
  {
    key: "REDIS_URL",
    critical: false,
    description: "Upstash Redis URL — rate limiting and caching disabled without this",
  },
  // gemini
  {
    key: "GEMINI_API_KEY",
    critical: false,
    description: "Google Gemini API key",
  },
  // cloudinary
  {
    key: "CLOUDINARY_CLOUD_NAME",
    critical: false,
    description: "Cloudinary cloud name",
  },
  {
    key: "CLOUDINARY_API_KEY",
    critical: false,
    description: "Cloudinary API key",
  },
  {
    key: "CLOUDINARY_API_SECRET",
    critical: false,
    description: "Cloudinary API secret",
  },
];

// called once on server boot from instrumentation.ts
export function assertEnvVars(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const { key, critical, description } of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      if (critical) {
        missing.push(`  ❌ ${key}  — ${description}`);
      } else {
        warnings.push(`  ⚠️  ${key}  — ${description}`);
      }
    }
  }

  // warn about optional missing vars
  if (warnings.length > 0) {
    console.warn(
      "\n[DCart] ⚠️  Optional environment variables are not set:\n" +
        warnings.join("\n") +
        "\n  Some features may not work correctly.\n"
    );
  }

  // throw for critical missing vars so the server fails fast
  if (missing.length > 0) {
    throw new Error(
      "\n[DCart] 🚨 CRITICAL: Required environment variables are missing.\n" +
        "  The server cannot start safely without them:\n\n" +
        missing.join("\n") +
        "\n\n  Set these variables in your .env.local file and restart the server.\n"
    );
  }

  console.info("[DCart] ✅ Environment variable check passed.");
}
