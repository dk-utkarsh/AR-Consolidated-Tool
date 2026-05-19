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
CMD ["node", "dist/server.js"]
