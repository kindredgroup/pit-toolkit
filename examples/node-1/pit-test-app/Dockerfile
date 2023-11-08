FROM node:16.13.2-alpine3.15

RUN mkdir /app

WORKDIR /app

COPY node_modules ./node_modules
COPY package.json package.json
COPY dist ./dist

# - Requires environment TARGET_SERVICE_URL which specifies the full URL of
#   application under test: protocol://host:port
# - Requires environment SERVICE_PORT

CMD node dist/index.js