import clientPromise from "../../../lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  const client = await clientPromise;
  const db = client.db("ducktype");
  const convs = await db
    .collection("conversations")
    .find()
    .sort({ updatedAt: -1 })
    .toArray();

  const transformed = convs.map((c) => ({
    ...c,
    _id: c._id?.toString?.(),
    createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
    updatedAt: c.updatedAt?.toISOString?.() ?? c.updatedAt,
    messages: Array.isArray(c.messages) ? c.messages.map((m: any) => ({ ...m, createdAt: m.createdAt?.toISOString?.() ?? m.createdAt })) : [],
  }));

  return NextResponse.json(transformed);
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const title = payload?.title ?? "New conversation";
    const now = new Date();

    const client = await clientPromise;
    const db = client.db("ducktype");

    const result = await db.collection("conversations").insertOne({
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ insertedId: result.insertedId.toString() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
