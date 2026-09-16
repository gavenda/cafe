FROM docker.io/oven/bun:1.3-alpine AS base

WORKDIR /usr/src/cafe

FROM base AS install

RUN mkdir -p /tmp/cafe
COPY package.json bun.lock /tmp/cafe/
RUN cd /tmp/cafe && bun install --frozen-lockfile --production

FROM base AS release

RUN mkdir -p data/logs
COPY --from=install /tmp/cafe/node_modules node_modules
COPY src ./src
COPY package.json tsconfig.json schema.sql index.ts ./

ENV SQLITE_FILE="/usr/src/cafe/data/cafe.sqlite"
RUN chown bun:bun /usr/src/cafe/data

USER bun
ENTRYPOINT [ "bun", "run", "index.ts" ]
