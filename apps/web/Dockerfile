FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .
RUN pnpm install && pnpm --filter web build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
