FROM node:23-alpine

ENV TERM=xterm
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /usr/app

COPY package.json package-lock.json nodemon.json .env ./

RUN npm install -g nodemon
RUN npm ci

EXPOSE 5172
