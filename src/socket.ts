import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { getSession, updateSession } from "./mongo";
import { connectedClients, io } from "./server";

export function createSocketIoServer(server: HttpServer) {
  return new Server(server, {
    cors: {
      origin: "*",
    },
  });
}

export function onError(error: Error) {
  console.error(error);
}

export function onConnection(socket: Socket) {
  connectedClients.push({
    socketId: socket.id,
    sessionId: null,
  });

  async function onJoinSessionHandler(data: { id: string; userId: string }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) {
      return;
    }

    connectedClients[index].sessionId = data.id;
    socket.join(data.id);

    const clients = connectedClients
      .filter((client) => client.sessionId === data.id)
      .map((c) => ({
        id: c.socketId,
      }));

    socket.emit("connected-clients", clients);

    for (let i = 0; i < connectedClients.length; i++) {
      if (connectedClients[i].sessionId !== data.id) {
        continue;
      }
      if (connectedClients[i].socketId === socket.id) {
        continue;
      }

      io.to(connectedClients[i].socketId).emit(
        "connected-clients",
        connectedClients
          .filter((c) => c.sessionId === data.id)
          .map((c) => ({ id: c.socketId })),
      );
    }
  }

  async function onLeaveSessionHandler() {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const id = connectedClients[index].sessionId;
    if (!id) return;

    connectedClients[index].sessionId = null;
    socket.leave(id);

    for (let i = 0; i < connectedClients.length; i++) {
      if (connectedClients[i].sessionId !== id) {
        continue;
      }
      if (connectedClients[i].socketId === socket.id) {
        continue;
      }

      io.to(connectedClients[i].socketId).emit(
        "connected-clients",
        connectedClients
          .filter((c) => c.sessionId === id)
          .map((c) => ({ id: c.socketId })),
      );
    }
  }

  async function onTextInputHandler(data: {
    text: string;
    id: string;
    language: string;
  }) {
    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    const sessionId = connectedClients[index].sessionId;

    if (!sessionId) return;

    const session = await getSession(sessionId);

    session.code = data.text;
    session.language = data.language;

    await updateSession(session);

    for (let i = 0; i < connectedClients.length; i++) {
      if (connectedClients[i].sessionId !== connectedClients[index].sessionId) {
        continue;
      }
      if (connectedClients[i].socketId === socket.id) {
        continue;
      }

      io.to(connectedClients[i].socketId).emit("text-input", {
        text: data.text,
        language: session.language,
      });
    }
  }

  function onDisconnect() {
    socket.rooms.forEach((room) => {
      socket.leave(room);
    });

    const index = connectedClients.findIndex(
      (client) => client.socketId === socket.id,
    );

    if (index === -1) return;

    if (connectedClients[index].sessionId) {
      for (let i = 0; i < connectedClients.length; i++) {
        if (
          connectedClients[i].sessionId === connectedClients[index].sessionId
        ) {
          io.to(connectedClients[i].socketId).emit(
            "connected-clients",
            connectedClients
              .filter((c) => c.sessionId === connectedClients[index].sessionId)
              .map((c) => ({ id: c.socketId })),
          );
        }
      }
    }

    connectedClients.splice(index, 1);
  }

  socket.on("join-session", onJoinSessionHandler);
  socket.on("leave-session", onLeaveSessionHandler);
  socket.on("text-input", onTextInputHandler);
  socket.on("disconnect", onDisconnect);
  socket.on("error", onError);
}
