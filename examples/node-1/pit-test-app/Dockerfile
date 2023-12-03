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
WORKDIR /opt/build
COPY package.json package-lock.json ./
COPY --from=BUILD /opt/build/node_modules/ ./node_modules
COPY --from=BUILD /opt/build/dist/ ./dist
# - Requires environment TARGET_SERVICE_URL which specifies the full URL of
#   application under test: protocol://host:port
# - Requires environment SERVICE_PORT
CMD node dist/index.js