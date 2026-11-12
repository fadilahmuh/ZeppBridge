FROM node:24-slim

WORKDIR /app

COPY package.json ./
COPY src ./src

ENV PORT=8080 \
    DB_PATH=/data/zepp.db \
    TZ=Asia/Jakarta

VOLUME /data

EXPOSE 8080

CMD ["node", "src/server.js"]
