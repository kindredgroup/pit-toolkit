FROM node:18.18.2-alpine3.18 AS baseimage

# Build image
FROM baseimage AS BUILD

ENV USER=pit
ENV UID=1001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    "${USER}"

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
COPY migrations/ ./migrations

USER ${USER}:${USER}

CMD ["npm", "run", "migrate_and_start"]

