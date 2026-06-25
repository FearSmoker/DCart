# =============================================================================
# DCart Next.js Multi-Stage Dockerfile
# =============================================================================
# NOTE: Ensure next.config.mjs has `output: 'standalone'` set before building.
#   module.exports = { output: 'standalone', ... }
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies only (cached layer)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: Build the Next.js application
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Pull in production deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source tree
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the app with stub env vars injected inline.
# Using a sourced temp file instead of ARG/ENV avoids Docker lint warnings
# about secrets in build args. The file is deleted after the build so nothing
# is baked into the image layer. Real values are supplied at runtime.
RUN printf '%s\n' \
      'NEXT_PUBLIC_SANITY_API_VERSION=2024-01-01' \
      'NEXT_PUBLIC_SANITY_DATASET=production' \
      'NEXT_PUBLIC_SANITY_PROJECT_ID=build-placeholder' \
      'NEXT_AUTH_URL=http://localhost:3000' \
      'NEXTAUTH_URL=http://localhost:3000' \
      'AUTH_SECRET=build-placeholder-secret-minimum-32-chars' \
      'NEXTAUTH_SECRET=build-placeholder-secret-minimum-32-chars' \
      'AUTH_TRUST_HOST=true' \
      'AUTH_GOOGLE_ID=build-placeholder' \
      'AUTH_GOOGLE_SECRET=build-placeholder' \
      'AUTH_GITHUB_ID=build-placeholder' \
      'AUTH_GITHUB_SECRET=build-placeholder' \
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_build_placeholder' \
      'STRIPE_SECRET_KEY=sk_test_build_placeholder' \
      'ADMIN_EMAIL=build@placeholder.com' \
      'NEXT_PUBLIC_ADMIN_EMAIL=build@placeholder.com' \
      'FIREBASE_SERVICE_ACCOUNT_KEY={}' \
      'REDIS_URL=redis://127.0.0.1:6379' \
      'GEMINI_API_KEY=build-placeholder' \
      'RECOMMENDATION_SERVICE_URL=http://127.0.0.1:8000' \
      'NEXT_PUBLIC_APP_NAME=DCart' \
      'PLATFORM_COMMISSION_RATE=0.10' \
      'NEXT_PUBLIC_APP_LOCALE=en-IN' \
      'NEXT_PUBLIC_CURRENCY=INR' \
      'CLOUDINARY_CLOUD_NAME=build-placeholder' \
      'CLOUDINARY_API_KEY=000000000000000' \
      'CLOUDINARY_API_SECRET=build-placeholder' \
      'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=build-placeholder' \
    > /tmp/.env.build && \
    set -a && . /tmp/.env.build && set +a && \
    npm run build && \
    rm /tmp/.env.build

# ---------------------------------------------------------------------------
# Stage 3: Production runner — minimal Alpine image
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only the artifacts needed at runtime
COPY --from=builder /app/public ./public

# Standalone output directory includes server + required node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Health check: verify the app responds on port 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
