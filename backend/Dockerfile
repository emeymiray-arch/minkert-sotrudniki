# syntax=docker/dockerfile:1

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY src ./src
COPY tsconfig*.json nest-cli.json ./

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
# Миграции при старте (удобно на PaaS без отдельного job)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
