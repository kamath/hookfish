# Build from the repository root so the pnpm workspace and its lockfile are in context:
#   docker build -f examples/docker/Dockerfile -t smithery-example .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY examples ./examples

RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@hookfish/example-docker
RUN pnpm deploy --filter=@hookfish/example-docker --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/examples/docker/serve.mjs ./serve.mjs
COPY --from=build /repo/examples/docker/dist ./dist

EXPOSE 3000
USER node
CMD ["node", "serve.mjs"]
