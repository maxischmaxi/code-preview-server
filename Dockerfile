FROM node:23-alpine

ENV TERM=xterm
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /usr/app

COPY package.json ./
COPY package-lock.json ./
COPY nodemon.json ./

RUN npm install -g nodemon
RUN npm ci

EXPOSE 5172
