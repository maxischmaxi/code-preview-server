FROM node:23-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json nodemon.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:23-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm install --only=production

EXPOSE 3000
CMD ["node", "dist/main.js"]
