FROM node:24-bookworm-slim AS css

WORKDIR /build
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run css

FROM denoland/deno:2.9.3 AS compile

WORKDIR /build
COPY --from=css /build .
RUN deno run -A dev.ts build \
  && deno compile --allow-read --allow-write --allow-net --allow-ffi --allow-env --allow-run \
  --include deno.json --include db/migrations --include static --include _fresh \
  --output /out/garagio main.ts

FROM debian:trixie-slim

RUN apt-get update && apt-get install --yes --no-install-recommends libsqlite3-0 \
  && ln -s "$(ldconfig -p | awk '/libsqlite3\.so\.0/{print $NF; exit}')" /usr/local/lib/libsqlite3.so \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /data
COPY --from=compile /out/garagio /usr/local/bin/garagio

ENV DENO_SQLITE_PATH=/usr/local/lib/libsqlite3.so
ENV PORT=8000
EXPOSE 8000

CMD ["garagio"]