import clientPromise from "../../../lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  const client = await clientPromise;
  const db = client.db("ducktype");
  const msgs = await db
    .collection("messages")
    .find()
    .sort({ createdAt: -1 })
    .toArray();

  // Convert ObjectId/Date to strings for safe JSON consumption on the client
  const transformed = msgs.map((m) => ({
    ...m,
    _id: m._id?.toString?.(),
    createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
  }));

  return NextResponse.json(transformed);
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    if (!payload?.user || !payload?.ai) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
    payload.createdAt = new Date();
    const client = await clientPromise;
    const db = client.db("ducktype");
    const result = await db.collection("messages").insertOne(payload);
    return NextResponse.json({ insertedId: result.insertedId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
