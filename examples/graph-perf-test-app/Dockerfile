FROM grafana/k6:0.47.0 AS k6official
FROM node:18.18.2-alpine3.18 AS baseimage

# Build image
FROM baseimage AS BUILD
WORKDIR /opt/build
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src/ ./src
RUN npm run build

# Run image
FROM baseimage AS RUN

RUN apk update && apk upgrade && apk add bash && apk add jq

WORKDIR /opt/build
COPY package.json package-lock.json ./
COPY --from=BUILD /opt/build/node_modules/ ./node_modules
COPY --from=BUILD /opt/build/dist/ ./dist
COPY --from=k6official /usr/bin/k6 /usr/bin/k6
COPY k6-tests ./k6-tests
COPY scripts ./scripts
RUN chmod 755 ./scripts/k6-test-runner.sh


# Requires environment variable:
# - SERVICE_PORT
# - TARGET_URL (for k6 target)
CMD node dist/index.js