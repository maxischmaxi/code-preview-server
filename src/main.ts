import { connect, createSession, getSession, isMongoConnected } from "./mongo";
import { onConnection, onError } from "./socket";
import { app, io, server } from "./server";

app.get("/", async (_, res) => {
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
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/session/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const session = await getSession(id);
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

io.on("connection", onConnection);
io.on("error", onError);

connect()
  .then(() => {
    server.listen({
      port: 3000,
      host: "0.0.0.0",
    });
  })
  .catch(console.error);
