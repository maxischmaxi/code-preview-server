import { MongoClient, ObjectId } from "mongodb";
import { Session, Template } from "./definitions";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const mongo_url = process.env.MONGO_URL;

let client = new MongoClient(mongo_url!);
const db = client.db("collab");
const templates = db.collection("templates");
const sessions = db.collection("sessions");

export async function getTemplate(id: string): Promise<Template> {
  const template = await templates.findOne({ _id: new ObjectId(id) });
  if (template === null) {
    throw new Error("Template not found");
  }

  return {
    id: template._id.toHexString(),
    title: template.title,
    code: template.code,
    solution: template.solution,
    language: template.language,
  };
}

export async function reset(): Promise<void> {
  const sessions = await getAllSessions();
  for (const session of sessions) {
    const created = dayjs(session.createdAt);

    if (dayjs().diff(created, "seconds") > 60) {
      await deleteSession(session.id);
    }
  }
}

export async function createTemplate(
  data: Omit<Template, "id">,
): Promise<Template> {
  const id = new ObjectId();
  await templates.insertOne({ _id: id, ...data });

  return {
    id: id.toHexString(),
    ...data,
  };
}

export async function updateTemplate(data: Template): Promise<Template> {
  await templates.updateOne(
    { _id: new ObjectId(data.id) },
    {
      $set: {
        title: data.title,
        code: data.code,
        solution: data.solution,
      },
    },
  );

  return data;
}

export async function getAllTemplates(): Promise<Template[]> {
  const t = await templates.find().toArray();
  if (t.length === 0) {
    return [];
  }

  return t.map((template: any) => ({
    id: template._id.toHexString(),
    title: template.title,
    code: template.code,
    solution: template.solution,
    language: template.language,
  }));
}

export async function deleteTemplate(id: string): Promise<void> {
  await templates.deleteOne({ _id: new ObjectId(id) });
}

export async function deleteSession(id: string): Promise<void> {
  await sessions.deleteOne({ _id: new ObjectId(id) });
}

export async function createSession(userId: string): Promise<Session> {
  const id = new ObjectId();
  const createdAt = dayjs().toISOString();
  await sessions.insertOne({
    _id: id,
    language: "typescript",
    code: "",
    createdAt,
    lintingEnabled: false,
    createdBy: userId,
  });

  return {
    solution: "",
    id: id.toHexString(),
    language: "typescript",
    createdBy: userId,
    admins: [],
    code: "",
    createdAt,
    lintingEnabled: false,
  };
}

export async function getAllSessions(): Promise<Session[]> {
  const s = await sessions.find().toArray();
  if (s.length === 0) {
    return [];
  }

  return s.map((session: any) => ({
    solution: session.solution ?? "",
    id: session._id.toHexString(),
    language: session.language ?? "",
    code: session.code ?? "",
    createdAt: session.createdAt ?? "",
    lintingEnabled: session.lintingEnabled ?? false,
    admins: session.admins ?? [],
    createdBy: session.createdBy ?? "",
  }));
}

export async function getSession(id: string): Promise<Session> {
  const session = await sessions.findOne({ _id: new ObjectId(id) });
  if (session === null) {
    throw new Error("Session not found");
  }

  return {
    solution: session.solution ?? "",
    id: session._id.toHexString(),
    language: session.language ?? "",
    code: session.code ?? "",
    admins: session.admins ?? [],
    createdBy: session.createdBy ?? "",
    createdAt: session.createdAt ?? "",
    lintingEnabled: session.lintingEnabled ?? false,
  };
}

export async function updateSession(session: Session): Promise<void> {
  await sessions.updateOne(
    { _id: new ObjectId(session.id) },
    {
      $set: {
        code: session.code,
        language: session.language,
        lintingEnabled: session.lintingEnabled,
        admins: session.admins,
        solution: session.solution,
      },
    },
  );
}
