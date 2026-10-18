FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# Applies pending migrations, then exits. Run by the migrate service in
# docker-compose.yml before the app starts, in development and production.
FROM deps AS migrate
COPY prisma ./prisma
COPY prisma.config.ts ./
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# Development server: source is bind-mounted by docker-compose.override.yml
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000
# Generate the Prisma client into the bind-mounted source before starting.
CMD ["sh", "-c", "node_modules/.bin/prisma generate && exec node_modules/.bin/next dev -H 0.0.0.0 -p 3000"]

# Build the app
FROM base AS builder
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node_modules/.bin/prisma generate && npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE ${PORT}
CMD ["node", "server.js"]
