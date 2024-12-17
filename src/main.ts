import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import {
  Change,
  File,
  ConnectedClient,
  CursorSelection,
  CursorPosition,
} from "./definitions";
import express from "express";
import {
  connect,
  createSession,
  getAllSessions,
  getSession,
  isMongoConnected,
} from "./mongo";

const app = express();
const server = createServer(app);
const connectedClients: ConnectedClient[] = [];
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(
  cors({
    origin: "*",
  }),
);

app.get("/", (_, res) => {
  if (!isMongoConnected()) {
    res.json({ status: "error", message: "Not connected to MongoDB" });
    return;
  }

  res.json({ status: "OK" });
});

app.post("/session", async (_, res) => {
  try {
    const session = await createSession();
    res.json(session);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/session/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const session = await getSession(id);
    res.json(session);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/sessions", async (_, res) => {
  try {
    const sessions = await getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const file: File = {
  name: "index.ts",
  language: "typescript",
  value: `import React from 'react';
import ReactDOM from 'react-dom';

import Editor, { useMonaco } from '@monaco-editor/react';

function App() {
  const monaco = useMonaco();

  useEffect(() => {
    if (monaco) {
      console.log('here is the monaco instance:', monaco);
    }
  }, [monaco]);

  return <Editor height="90vh" defaultValue="// some comment" defaultLanguage="javascript" />;
}

const rootElement = document.getElementById('root');
ReactDOM.render(<App />, rootElement);

das ist ein test
`,
};

io.on("connection", (socket) => {
  console.log(socket.id + " connected");
  socket.emit("change", file);

  connectedClients.push({
    id: socket.id,
    cursorPosition: {
      lineNumber: 1,
      column: 1,
    },
    cursorSelection: null,
  });

  socket.on("change", (changes: Array<Change>) => {
    if (!isMongoConnected()) {
      return;
    }

    const newValue = file.value;
    for (const change of changes) {
      const start = newValue.substring(0, change.rangeOffset);
      const end = newValue.substring(change.rangeOffset + change.rangeLength);
      file.value = start + change.text + end;
    }

    for (let i = 0; i < connectedClients.length; i++) {
      if (connectedClients[i].id !== socket.id) {
        socket.to(connectedClients[i].id).emit("change", file);
      }
    }
  });

  socket.on("replaceText", (text: string) => {
    if (!isMongoConnected()) {
      return;
    }

    file.value = text;
    socket.broadcast.emit("change", file);
    socket.emit("change", file);
  });

  socket.on("getCursorPositions", () => {
    if (!isMongoConnected()) {
      return;
    }

    const positions = connectedClients.filter(
      (client) => client.id !== socket.id,
    );

    socket.emit("cursorPositions", positions);
  });

  socket.on("cursorSelection", (selection: CursorSelection) => {
    if (!isMongoConnected()) {
      return;
    }

    for (let i = 0; i < connectedClients.length; i++) {
      if (connectedClients[i].id === socket.id) {
        connectedClients[i].cursorSelection = selection;
      } else {
        socket.to(connectedClients[i].id).emit("cursorSelection", {
          id: socket.id,
          cursorSelection: selection,
          cursorPosition: connectedClients[i].cursorPosition,
        });
      }
    }
  });

  socket.on("cursorPosition", (cursorPosition: CursorPosition) => {
    if (!isMongoConnected()) {
      return;
    }

    for (let i = 0; i < connectedClients.length; i++) {
      if (connectedClients[i].id === socket.id) {
        connectedClients[i].cursorPosition = cursorPosition;
      } else {
        socket.to(connectedClients[i].id).emit("cursorPosition", {
          id: socket.id,
          cursorPosition,
          cursorSelection: connectedClients[i].cursorSelection,
        });
      }
    }
  });

  socket.on("disconnect", () => {
    if (!isMongoConnected()) {
      return;
    }

    console.log(socket.id + " disconnected");
    const index = connectedClients.findIndex(
      (client) => client.id === socket.id,
    );
    connectedClients.splice(index, 1);
    socket.broadcast.emit("clientDisconnected", socket.id);
  });

  socket.on("error", (error) => {
    console.log(error);
  });
});

io.on("error", (error) => {
  console.log(error);
});

connect()
  .then(() => {
    server.listen(
      {
        port: 5172,
        host: "0.0.0.0",
      },
      () => {
        console.log("Server is running on port 5172");
      },
    );
  })
  .catch(console.error);
