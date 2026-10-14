FROM node:20-alpine AS builder

WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
RUN npm install -g pnpm@8.15.4
ENV PNPM_PACKAGE_MANAGER_STRICT=false

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @ero/shared build
RUN pnpm --filter @ero/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
