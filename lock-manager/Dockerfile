FROM node:18.18.2-alpine3.18 AS baseimage

# Build image
FROM baseimage AS BUILD

WORKDIR /opt/build
COPY ${pwd}/lock-manager/package.json ${pwd}/lock-manager/package-lock.json ${pwd}/lock-manager/tsconfig.json ./
RUN npm ci

COPY ${pwd}/lock-manager/src/ ./src

RUN npm run build

# Run image
FROM baseimage AS RUN

WORKDIR /opt/build

COPY ${pwd}/lock-manager/package.json ${pwd}/lock-manager/package-lock.json ./
COPY --from=BUILD /opt/build/node_modules/ ./node_modules
COPY --from=BUILD /opt/build/dist/ ./dist
COPY ${pwd}/lock-manager/migrations/ ./migrations

CMD ["npm", "run", "migrate_and_start"]

