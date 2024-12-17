import { MongoClient, ObjectId } from "mongodb";
import { Session } from "./definitions";

const mongo_url = "mongodb://root:wdghkla123@mongo:27017";
let client: MongoClient | null = null;

export async function connect() {
  if (client !== null) {
    return;
  }

  console.log("Connecting to MongoDB");
  client = await MongoClient.connect(mongo_url);
  console.log("Connected to MongoDB");
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
  await collection.insertOne({ name: "New Session", _id: id });

  return {
    id: id.toHexString(),
    name: "New Session",
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
    name: session.name,
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
    name: session.name,
  };
}
