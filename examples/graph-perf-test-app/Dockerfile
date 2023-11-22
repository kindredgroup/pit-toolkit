FROM grafana/k6:0.47.0 AS k6official
FROM node:16.13.2-alpine3.15

COPY --from=k6official /usr/bin/k6 /usr/bin/k6

RUN apk update && apk upgrade && apk add bash

RUN mkdir /app

WORKDIR /app

COPY k6-tests ./k6-tests
COPY node_modules ./node_modules
COPY package.json package.json
COPY dist ./dist
COPY scripts ./scripts
RUN chmod 755 ./scripts/k6-test-runner.sh

# Requires environment variable:
# - SERVICE_PORT
# - TARGET_URL (for k6 target)

CMD node dist/index.js