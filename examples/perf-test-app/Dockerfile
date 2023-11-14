FROM grafana/k6:0.47.0 AS k6official
FROM node:16.13.2-alpine3.15

COPY --from=k6official /usr/bin/k6 /usr/bin/k6

RUN mkdir /app

WORKDIR /app

COPY k6-tests ./k6-tests
COPY node_modules ./node_modules
COPY package.json package.json
COPY dist ./dist

# Requires environment variable:
# - SERVICE_PORT
# - TARGET_URL (for k6 target)

CMD node dist/index.js
#CMD k6 run -q --summary-export ./summary.json k6-tests/perf-test-time.js && cat summary.json