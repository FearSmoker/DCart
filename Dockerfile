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

# Build-time stub values — passed as ARG so they are available during `next build`
# but are NOT baked into the final image layers (unlike ENV).
# Real values are injected at container runtime via docker-compose / .env.docker.
ARG NEXT_PUBLIC_SANITY_API_VERSION=2024-01-01
ARG NEXT_PUBLIC_SANITY_DATASET=production
ARG NEXT_PUBLIC_SANITY_PROJECT_ID=build-placeholder
ARG NEXT_AUTH_URL=http://localhost:3000
ARG NEXTAUTH_URL=http://localhost:3000
ARG AUTH_SECRET=build-placeholder-secret-minimum-32-chars
ARG NEXTAUTH_SECRET=build-placeholder-secret-minimum-32-chars
ARG AUTH_TRUST_HOST=true
ARG AUTH_GOOGLE_ID=build-placeholder
ARG AUTH_GOOGLE_SECRET=build-placeholder
ARG AUTH_GITHUB_ID=build-placeholder
ARG AUTH_GITHUB_SECRET=build-placeholder
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_build_placeholder
ARG STRIPE_SECRET_KEY=sk_test_build_placeholder
ARG ADMIN_EMAIL=build@placeholder.com
ARG NEXT_PUBLIC_ADMIN_EMAIL=build@placeholder.com
ARG FIREBASE_SERVICE_ACCOUNT_KEY={}
ARG REDIS_URL=redis://127.0.0.1:6379
ARG GEMINI_API_KEY=build-placeholder
ARG RECOMMENDATION_SERVICE_URL=http://127.0.0.1:8000
ARG NEXT_PUBLIC_APP_NAME=DCart
ARG PLATFORM_COMMISSION_RATE=0.10
ARG NEXT_PUBLIC_APP_LOCALE=en-IN
ARG NEXT_PUBLIC_CURRENCY=INR
ARG CLOUDINARY_CLOUD_NAME=build-placeholder
ARG CLOUDINARY_API_KEY=000000000000000
ARG CLOUDINARY_API_SECRET=build-placeholder
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=build-placeholder

# Expose ARGs as env vars for the RUN step only (still not in final image)
ENV NEXT_PUBLIC_SANITY_API_VERSION=$NEXT_PUBLIC_SANITY_API_VERSION \
    NEXT_PUBLIC_SANITY_DATASET=$NEXT_PUBLIC_SANITY_DATASET \
    NEXT_PUBLIC_SANITY_PROJECT_ID=$NEXT_PUBLIC_SANITY_PROJECT_ID \
    NEXT_AUTH_URL=$NEXT_AUTH_URL \
    NEXTAUTH_URL=$NEXTAUTH_URL \
    AUTH_SECRET=$AUTH_SECRET \
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
    AUTH_TRUST_HOST=$AUTH_TRUST_HOST \
    AUTH_GOOGLE_ID=$AUTH_GOOGLE_ID \
    AUTH_GOOGLE_SECRET=$AUTH_GOOGLE_SECRET \
    AUTH_GITHUB_ID=$AUTH_GITHUB_ID \
    AUTH_GITHUB_SECRET=$AUTH_GITHUB_SECRET \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
    ADMIN_EMAIL=$ADMIN_EMAIL \
    NEXT_PUBLIC_ADMIN_EMAIL=$NEXT_PUBLIC_ADMIN_EMAIL \
    FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY \
    REDIS_URL=$REDIS_URL \
    GEMINI_API_KEY=$GEMINI_API_KEY \
    RECOMMENDATION_SERVICE_URL=$RECOMMENDATION_SERVICE_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    PLATFORM_COMMISSION_RATE=$PLATFORM_COMMISSION_RATE \
    NEXT_PUBLIC_APP_LOCALE=$NEXT_PUBLIC_APP_LOCALE \
    NEXT_PUBLIC_CURRENCY=$NEXT_PUBLIC_CURRENCY \
    CLOUDINARY_CLOUD_NAME=$CLOUDINARY_CLOUD_NAME \
    CLOUDINARY_API_KEY=$CLOUDINARY_API_KEY \
    CLOUDINARY_API_SECRET=$CLOUDINARY_API_SECRET \
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

# Build the standalone Next.js application
RUN npm run build

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
