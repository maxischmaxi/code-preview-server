import { MongoClient, ObjectId } from "mongodb";
import { Session, User } from "./definitions";

const mongo_url = process.env.MONGO_URL;
let client: MongoClient | null = null;

export async function connect() {
  if (client !== null || mongo_url === undefined) return;

  client = await MongoClient.connect(mongo_url);
}

export function isMongoConnected() {
  return client !== null;
}

export async function createSession(): Promise<Session> {
  if (!isMongoConnected()) {
    throw new Error("MongoDB is not connected");
  }

  const db = client!.db("collab");
  const collection = db.collection("sessions");
  const id = new ObjectId();
  await collection.insertOne({
    name: "New Session",
    _id: id,
    language: "typescript",
    code: "",
  });

  return {
    id: id.toHexString(),
    name: "New Session",
    language: "typescript",
    code: "",
  };
}

export async function getAllSessions(): Promise<Session[]> {
  if (!isMongoConnected()) {
    throw new Error("MongoDB is not connected");
  }

  const db = client!.db("collab");
  const collection = db.collection("sessions");
  const sessions = await collection.find().toArray();
  if (sessions.length === 0) {
    return [];
  }

  return sessions.map((session: any) => ({
    id: session._id.toHexString(),
    name: session.name ?? "New Session",
    language: session.language ?? "",
    code: session.code ?? "",
  }));
}

export async function getSession(id: string): Promise<Session> {
  if (!isMongoConnected()) {
    throw new Error("MongoDB is not connected");
  }

  const db = client!.db("collab");
  const collection = db.collection("sessions");
  const session = await collection.findOne({ _id: new ObjectId(id) });
  if (session === null) {
    throw new Error("Session not found");
  }

  return {
    id: session._id.toHexString(),
    name: session.name ?? "New Session",
    language: session.language ?? "",
    code: session.code ?? "",
  };
}

export async function updateSession(session: Session): Promise<void> {
  if (!isMongoConnected()) {
    throw new Error("MongoDB is not connected");
  }

  const db = client!.db("collab");
  const collection = db.collection("sessions");
  await collection.updateOne(
    { _id: new ObjectId(session.id) },
    {
      $set: {
        name: session.name,
        code: session.code,
        language: session.language,
      },
    },
  );
}

export async function getUserById(id: string): Promise<User | null> {
  if (!isMongoConnected()) {
    throw new Error("MongoDB is not connected");
  }

  const db = client!.db("collab");
  const collection = db.collection("users");
  const user = await collection.findOne({ _id: new ObjectId(id) });

  if (user === null) {
    return null;
  }

  return {
    id: user._id.toHexString(),
  };
}

export async function createUser(): Promise<User> {
  if (!isMongoConnected()) {
    throw new Error("MongoDB is not connected");
  }

  const db = client!.db("collab");
  const collection = db.collection("users");
  const id = new ObjectId();
  await collection.insertOne({
    _id: id,
  });
  return {
    id: id.toHexString(),
  };
}
