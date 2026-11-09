# Production image for stock-market-web (Next.js standalone server).
# Loopback-bound like the API: Caddy terminates TLS and reverse-proxies.
# API_ORIGIN is baked at build time (server-side rewrites to Java).
FROM docker.io/library/node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker.io/library/node:22-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN apk add --no-cache curl
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/.next ./.next
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["npm", "start"]
