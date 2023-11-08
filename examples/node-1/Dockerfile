FROM node:16.13.2-alpine3.15

RUN mkdir /app

WORKDIR /app

COPY node_modules ./node_modules
COPY package.json package.json
COPY dist ./dist

# - Requires environment SERVICE_PORT

CMD node dist/index.js