import clientPromise from "../../../../../lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function POST(req: Request, { params }: { params: any }) {
  try {
    const p = await params;
    const id = p?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { user, ai } = await req.json();
    if (!user || !ai) return NextResponse.json({ error: "Missing payload" }, { status: 400 });

    const oid = new ObjectId(id);
    const client = await clientPromise;
    const db = client.db("ducktype");
    const now = new Date();

    const updateRes = await db.collection("conversations").findOneAndUpdate(
      { _id: oid },
      { $push: { messages: { user, ai, createdAt: now } }, $set: { updatedAt: now } },
      { returnDocument: "after" }
    );

    if (!updateRes.value) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const conv = updateRes.value;
    const lastMsg = conv.messages[conv.messages.length - 1];
    const createdAt = lastMsg?.createdAt ? new Date(lastMsg.createdAt).toISOString() : lastMsg?.createdAt;
    return NextResponse.json({ message: { ...lastMsg, createdAt } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
