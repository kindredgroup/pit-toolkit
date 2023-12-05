FROM node:18.18.2-alpine3.18 AS baseimage

# Build image
FROM baseimage AS BUILD

WORKDIR /opt/build
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY migrations/ ./migrations

# load env 
COPY .env ./

#  multiple scripts to load env variables 


# run db migrations
# RUN 

# if migrations are successful, copy the rest of the source code

COPY src/ ./src
# RUN ifconfig | grep "inet " | grep -Fv 127.0.0.1 | awk '{print $2}'

RUN  npm run migrate:up

RUN npm run build

# Run image
FROM baseimage AS RUN
WORKDIR /opt/build
COPY package.json package-lock.json ./
COPY --from=BUILD /opt/build/node_modules/ ./node_modules
COPY --from=BUILD /opt/build/dist/ ./dist
CMD node dist/index.js

