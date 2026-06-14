FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY assets/sample ./assets/sample
COPY README.md ./

RUN mkdir -p storage/uploads storage/output \
  && chown -R node:node /app

USER node

CMD ["npm", "run", "bot"]
