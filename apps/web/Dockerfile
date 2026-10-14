FROM node:20-alpine AS builder

WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@8.15.4
ENV PNPM_PACKAGE_MANAGER_STRICT=false

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @ero/shared build
RUN pnpm --filter @ero/web build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
