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
import {
  ConnectedClient,
  CursorPosition,
  CursorSelection,
  SocketEvent,
} from "./definitions";
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

let cursorPositions: CursorPosition[] = [];
let cursorSelections: CursorSelection[] = [];
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
  const { id, nickname } = req.body;

  if (typeof id !== "string" || !id) {
    res.status(400).json({ status: "error", message: "Invalid id" });
    if (process.env.NODE_ENV === "development") {
      console.log("Invalid id", id);
    }
    return;
  }

  if (typeof nickname !== "string" || !nickname) {
    res.status(400).json({ status: "error", message: "Invalid nickname" });
    if (process.env.NODE_ENV === "development") {
      console.log("Invalid nickname", nickname);
    }
    return;
  }

  const index = connectedClients.findIndex((c) => c.userId === id);
  if (index > -1) {
    connectedClients[index].nickname = nickname;
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
    if (process.env.NODE_ENV === "development") {
      console.log("Error getting session", error.message);
    }

    res.status(500).json({ status: "error", message: error.message });
  }
});

io.on("connection", function (socket) {
  async function joinHandler({
    id,
    nickname,
  }: {
    id: string;
    nickname: string;
  }) {
    connectedClients = connectedClients.filter((c) => c.userId !== id);
    const client: ConnectedClient = {
      socketId: socket.id,
      sessionId: null,
      userId: id,
      nickname,
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
      for (const client of clients) {
        io.to(client.socketId).emit(SocketEvent.JOIN_SESSION, clients);
      }
    }
  }

  async function onLeaveSessionHandler() {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const sessionId = connectedClients[index].sessionId;
    connectedClients[index].sessionId = null;
    if (sessionId) {
      socket.leave(sessionId);
    }

    const clients = connectedClients.filter(
      (c) => c.sessionId === sessionId && c.socketId !== socket.id,
    );

    for (const client of clients) {
      io.to(client.socketId).emit(
        SocketEvent.LEAVE_SESSION,
        connectedClients[index],
      );
    }
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

    for (const client of connectedClients) {
      if (client.sessionId === sessionId && client.socketId !== socket.id) {
        io.to(client.socketId).emit(SocketEvent.TEXT_INPUT, {
          text: data.text,
        });
      }
    }
  }

  function onDisconnect() {
    if (process.env.NODE_ENV === "development") {
      console.log("Disconnect", socket.id);
    }

    const client = connectedClients.find((c) => c.socketId === socket.id);

    if (!client) return;

    const session = client.sessionId;

    if (session) {
      socket.leave(session);

      const clients = connectedClients.filter(
        (c) => c.sessionId === session && c.socketId !== socket.id,
      );

      for (const client of clients) {
        io.to(client.socketId).emit(SocketEvent.LEAVE_SESSION, clients);
      }
    }
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
    session.solutionPresented = false;
    session.language = template.language;
    await updateSession(session);

    for (const client of connectedClients) {
      if (
        client.sessionId === data.sessionId &&
        client.socketId !== socket.id
      ) {
        io.to(client.socketId).emit(SocketEvent.TEXT_INPUT, {
          text: session.code,
        });

        io.to(data.sessionId).emit(SocketEvent.LANGUAGE_CHANGE, {
          language: session.language,
        });
        io.to(client.socketId).emit(SocketEvent.SET_SOLUTION, session.solution);
      }
    }
  }

  async function onSolutionPresentedHandler(data: {
    sessionId: string;
    userId: string;
    presented: boolean;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const session = await getSession(data.sessionId);

    if (
      connectedClients[index].userId !== session.createdBy &&
      !session.admins.includes(connectedClients[index].userId)
    ) {
      return;
    }

    session.solutionPresented = data.presented;
    await updateSession(session);

    for (const client of connectedClients) {
      if (
        client.sessionId === data.sessionId &&
        client.socketId !== socket.id
      ) {
        io.to(client.socketId).emit(
          SocketEvent.SOLUTION_PRESENTED,
          data.presented,
        );
      }
    }
  }

  function onSendCursorPositionHandler(data: CursorPosition) {
    const cursorIndex = cursorPositions.findIndex(
      (c) => c.userId === data.userId && c.sessionId === data.sessionId,
    );

    if (cursorIndex > -1) {
      cursorPositions[cursorIndex] = data;
    } else {
      cursorPositions.push(data);
    }

    io.to(data.sessionId).emit(
      SocketEvent.SEND_CURSOR_POSITION,
      cursorPositions.filter((c) => c.sessionId === data.sessionId),
    );
  }

  function onRemoveCursor(data: { sessionId: string; userId: string }) {
    cursorPositions = cursorPositions.filter(
      (c) => c.sessionId !== data.sessionId || c.userId !== data.userId,
    );

    cursorSelections = cursorSelections.filter(
      (c) => c.sessionId !== data.sessionId || c.userId !== data.userId,
    );

    for (const client of connectedClients) {
      if (
        client.sessionId === data.sessionId &&
        client.socketId !== socket.id
      ) {
        io.to(client.socketId).emit(SocketEvent.REMOVE_CURSOR, data.userId);
      }
    }
  }

  function onNicknameHandler(nickname: string) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    connectedClients[index].nickname = nickname;

    const sessionId = connectedClients[index].sessionId;
    if (sessionId) {
      io.to(sessionId).emit(SocketEvent.SET_NICKNAME, connectedClients[index]);
    }
  }

  async function onLinting(data: {
    sessionId: string;
    userId: string;
    linting: boolean;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const session = await getSession(data.sessionId);

    if (
      connectedClients[index].userId !== session.createdBy &&
      !session.admins.includes(connectedClients[index].userId)
    ) {
      return;
    }

    session.linting = data.linting;
    await updateSession(session);

    io.to(data.sessionId).emit(SocketEvent.SET_LINTING, data.linting);
  }

  function onSetSelection(data: {
    sessionId: string;
    userId: string;
    selection: {
      startColumn: number;
      startLineNumber: number;
      endColumn: number;
      endLineNumber: number;
    };
  }) {
    const index = cursorSelections.findIndex(
      (c) => c.userId === data.userId && c.sessionId === data.sessionId,
    );

    if (index > -1) {
      cursorSelections[index] = {
        sessionId: data.sessionId,
        userId: data.userId,
        ...data.selection,
      };
    } else {
      cursorSelections.push({
        sessionId: data.sessionId,
        userId: data.userId,
        ...data.selection,
      });
    }

    io.to(data.sessionId).emit(
      SocketEvent.SET_SELECTION,
      cursorSelections.filter((c) => c.sessionId === data.sessionId),
    );
  }

  socket.on(SocketEvent.JOIN, joinHandler);
  socket.on(SocketEvent.JOIN_SESSION, onJoinSessionHandler);
  socket.on(SocketEvent.LEAVE_SESSION, onLeaveSessionHandler);
  socket.on(SocketEvent.TEXT_INPUT, onTextInputHandler);
  socket.on(SocketEvent.LANGUAGE_CHANGE, onLanguageChangeHandler);
  socket.on(SocketEvent.SET_ADMIN, onSetAdminHandler);
  socket.on(SocketEvent.REMOVE_ADMIN, onRemoveAdminHandler);
  socket.on(SocketEvent.SET_SOLUTION, onSetSolutionHandler);
  socket.on(SocketEvent.SOLUTION_PRESENTED, onSolutionPresentedHandler);
  socket.on(SocketEvent.SEND_CURSOR_POSITION, onSendCursorPositionHandler);
  socket.on(SocketEvent.REMOVE_CURSOR, onRemoveCursor);
  socket.on(SocketEvent.SET_NICKNAME, onNicknameHandler);
  socket.on(SocketEvent.SET_LINTING, onLinting);
  socket.on(SocketEvent.SET_SELECTION, onSetSelection);
  socket.on("disconnect", onDisconnect);
  socket.on("error", (error) => {
    console.error(error);
  });
});

io.on("error", (error) => {
  console.error(error);
});

server.listen({
  port: port,
  host: "0.0.0.0",
});
