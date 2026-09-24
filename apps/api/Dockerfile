FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["pnpm", "dev"]
