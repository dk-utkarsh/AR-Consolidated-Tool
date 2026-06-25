# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY worker/package.json worker/package.json
# install at the workspace root so npm wires the worker into node_modules
RUN npm ci --workspaces --include-workspace-root || npm install
COPY worker ./worker
RUN npm run build --workspace worker

FROM node:20-alpine AS run
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/worker/dist ./worker/dist
COPY --from=build /app/worker/package.json ./worker/package.json
WORKDIR /app/worker
EXPOSE 8080
# Render's free/starter instances are 512MB. Cap V8's heap below that so a
# genuinely oversized workbook fails with a clear "JavaScript heap out of
# memory" in the logs (and aggressive GC) instead of being silently
# SIGKILL'd by the kernel OOM-killer. Bump this if the instance plan grows.
ENV NODE_OPTIONS=--max-old-space-size=448
CMD ["node", "dist/server.js"]
