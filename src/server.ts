import { createServer } from "http";
import cors from "cors";
import express from "express";
import { createSocketIoServer } from "./socket";
import { ConnectedClient } from "./definitions";

export const app = express();
export const server = createServer(app);
export const io = createSocketIoServer(server);
export const connectedClients: ConnectedClient[] = [];

app.use(
  cors({
    origin: "*",
  }),
);
