import {
  createSession,
  createTemplate,
  getAllTemplates,
  getSession,
  getTemplate,
  reset,
  updateSession,
  updateTemplate,
} from "./mongo";
import dotenv from "dotenv";
import morgan from "morgan";
import express from "express";
import { ConnectedClient, SocketEvent } from "./definitions";
import { Server } from "socket.io";
import cors from "cors";
import http from "http";

dotenv.config();

const origin = ["https://code.jeschek.dev"];
if (process.env.NODE_ENV === "development") {
  origin.push("http://localhost:3000");
}
const corsOptions = {
  origin,
  methods: ["GET", "POST", "PATCH"],
  allowedHeaders: ["Authorization", "Content-Type", "Accept"],
};

let connectedClients: ConnectedClient[] = [];
const port = process.env.NODE_ENV === "development" ? 4000 : 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", async (_, res) => {
  res.json({ status: "OK" }).status(200);
});

app.get("/templates", async (_, res) => {
  const templates = await getAllTemplates();

  res.status(200).json(templates);
});

app.patch("/template", async (req, res) => {
  const { id, title, code, solution, language } = req.body;

  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof code !== "string" ||
    typeof solution !== "string" ||
    typeof language !== "string"
  ) {
    res.status(400).json({ status: "error", message: "Invalid data" });
    return;
  }

  try {
    const template = await getTemplate(id);
    template.title = title;
    template.code = code;
    template.solution = solution;
    template.language = language;

    await updateTemplate(template);
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/template", async (req, res) => {
  const { title, code, solution, language } = req.body;
  if (
    typeof title !== "string" ||
    typeof code !== "string" ||
    typeof solution !== "string" ||
    typeof language !== "string"
  ) {
    res.status(400).json({ status: "error", message: "Invalid data" });
    return;
  }

  try {
    const template = await createTemplate({
      title,
      code,
      solution,
      language,
    });
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/reset", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ status: "error", message: "Unauthorized" });
    return;
  }

  try {
    await reset();
    res.status(200).json({ status: "OK" });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/session", async (req, res) => {
  const { id } = req.body;

  if (typeof id !== "string" || !id) {
    res.status(400).json({ status: "error", message: "Invalid id" });
    if (process.env.NODE_ENV === "development") {
      console.log("Invalid id", id);
    }
    return;
  }

  try {
    const session = await createSession(id);
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
    if (process.env.NODE_ENV === "development") {
      console.log("Error creating session", error.message);
    }
  }
});

app.get("/session/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const session = await getSession(id);
    res.json(session).status(200);
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

io.on("connection", function (socket) {
  async function joinHandler(id: string) {
    connectedClients = connectedClients.filter((c) => c.userId !== id);
    const client: ConnectedClient = {
      socketId: socket.id,
      sessionId: null,
      userId: id,
    };

    connectedClients.push(client);
  }

  async function onJoinSessionHandler(data: {
    sessionId: string;
    userId: string;
  }) {
    const index = connectedClients.findIndex((c) => c.userId === data.userId);
    if (index > -1) {
      connectedClients[index].sessionId = data.sessionId;

      const clients = connectedClients.filter(
        (c) => c.sessionId === data.sessionId,
      );
      socket.join(data.sessionId);
      io.to(data.sessionId).emit(SocketEvent.JOIN_SESSION, clients);
    }
  }

  async function onLeaveSessionHandler() {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const id = connectedClients[index].sessionId;
    if (!id) return;

    io.to(id).emit(SocketEvent.LEAVE_SESSION, connectedClients[index]);
  }

  async function onTextInputHandler(data: {
    text: string;
    sessionId: string;
    userId: string;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const sessionId = connectedClients[index].sessionId;

    if (!sessionId) return;

    const session = await getSession(sessionId);

    session.code = data.text;

    await updateSession(session);

    io.to(sessionId).emit(SocketEvent.TEXT_INPUT, {
      text: data.text,
    });
  }

  function onDisconnect() {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );
    if (index > -1) {
      connectedClients.splice(index, 1);

      socket.rooms.forEach((room) => {
        socket.leave(room);
        io.to(room).emit(
          SocketEvent.LEAVE_SESSION,
          connectedClients.filter((c) => c.sessionId === room),
        );
      });
    }
  }

  async function onLintingUpdateHandler(data: {
    sessionId: string;
    lintingEnabled: boolean;
    id: string;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    if (connectedClients[index].sessionId !== data.sessionId) return;
    const session = await getSession(data.sessionId);
    session.lintingEnabled = data.lintingEnabled;
    await updateSession(session);
    io.to(session.id).emit(SocketEvent.LINTING_UPDATE, {
      lintingEnabled: data.lintingEnabled,
    });
  }

  async function onLanguageChangeHandler(data: {
    sessionId: string;
    language: string;
    id: string;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    if (connectedClients[index].sessionId !== data.sessionId) return;

    const session = await getSession(data.sessionId);
    session.language = data.language;

    await updateSession(session);
    io.to(data.sessionId).emit(SocketEvent.LANGUAGE_CHANGE, {
      language: data.language,
    });
  }

  async function onSetAdminHandler({
    sessionId,
    userId,
  }: {
    sessionId: string;
    userId: string;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const session = await getSession(sessionId);

    if (connectedClients[index].userId !== session.createdBy) {
      return;
    }

    if (!session.admins.includes(userId)) {
      session.admins.push(userId);
      await updateSession(session);
      io.to(sessionId).emit(SocketEvent.SET_ADMIN, session.admins);
    }
  }

  async function onRemoveAdminHandler({
    sessionId,
    userId,
  }: {
    sessionId: string;
    userId: string;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const session = await getSession(sessionId);

    if (connectedClients[index].userId !== session.createdBy) {
      return;
    }

    if (session.admins.includes(userId)) {
      session.admins = session.admins.filter((a) => a !== userId);
      await updateSession(session);
      io.to(sessionId).emit(SocketEvent.REMOVE_ADMIN, session.admins);
    }
  }

  async function onSetSolutionHandler(data: {
    userId: string;
    sessionId: string;
    templateId: string;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const session = await getSession(data.sessionId);
    const template = await getTemplate(data.templateId);

    if (
      connectedClients[index].userId !== session.createdBy &&
      !session.admins.includes(connectedClients[index].userId)
    ) {
      if (process.env.NODE_ENV === "development") {
        console.log("User is not admin");
      }
      return;
    }

    session.solution = template.solution;
    session.code = template.code;
    await updateSession(session);

    io.to(data.sessionId).emit(SocketEvent.SET_SOLUTION, session.solution);
    io.to(data.sessionId).emit(SocketEvent.TEXT_INPUT, {
      text: session.code,
    });
  }

  socket.on(SocketEvent.JOIN, joinHandler);
  socket.on(SocketEvent.JOIN_SESSION, onJoinSessionHandler);
  socket.on(SocketEvent.LEAVE_SESSION, onLeaveSessionHandler);
  socket.on(SocketEvent.TEXT_INPUT, onTextInputHandler);
  socket.on(SocketEvent.LANGUAGE_CHANGE, onLanguageChangeHandler);
  socket.on(SocketEvent.SET_ADMIN, onSetAdminHandler);
  socket.on(SocketEvent.REMOVE_ADMIN, onRemoveAdminHandler);
  socket.on(SocketEvent.SET_SOLUTION, onSetSolutionHandler);
  socket.on("disconnect", onDisconnect);
  socket.on("error", (error) => {
    console.error(error);
  });
  socket.on("linting-update", onLintingUpdateHandler);
});

io.on("error", (error) => {
  console.error(error);
});

server.listen({
  port: port,
  host: "0.0.0.0",
});
