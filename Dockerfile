FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN cd client && npm ci
RUN cd server && npm ci

COPY client ./client
COPY server ./server

RUN cd client && npm run build
RUN cd server && npm run build


FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

RUN mkdir -p /data/uploads

EXPOSE 3001

CMD ["node", "server/dist/server.js"]
