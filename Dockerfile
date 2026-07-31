# Both workshops in one container.
#
# This is one Next app serving four routes — AI Detective on `/` and `/tv`, The Decision Room on
# `/biz` and `/play` — so one image and one service covers the whole expo day. That is not a
# packaging convenience: both apps keep their room in a process-global backed by a local JSON
# file, so all four routes MUST be served by the same process. See deploy/deploy.sh, which pins
# the service to exactly one instance for the same reason.

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` needs the dev dependencies: the build runs TypeScript and Tailwind.
RUN npm ci

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── run ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root, and it needs to own the working directory: the room state is written to
# `.decision-room-state.json` and `.room-state.json` in the CWD at runtime.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs \
  && chown nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# `output: standalone` deliberately omits these two — its server serves them if they are placed
# here, and silently 404s every stylesheet and font if they are not.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

# Cloud Run injects PORT and expects the server to bind it on all interfaces.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]
