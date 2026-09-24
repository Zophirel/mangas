FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --filter web... --frozen-lockfile && pnpm --filter web build \
  && cp -R /app/apps/web/node_modules/@dearhive/dearflip-jquery-flipbook/dflip /app/apps/web/dist/dflip

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
