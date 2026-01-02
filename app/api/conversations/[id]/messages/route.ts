import clientPromise from "../../../../../lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import type { Collection } from "mongodb";

type DuckMessage = {
  user: string;
  ai: string;
  createdAt: Date;
};

type Conversation = {
  _id: ObjectId;
  messages: DuckMessage[];
  createdAt?: Date;
  updatedAt?: Date;
};

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params?.id; // ✅ no await
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { user, ai } = await req.json();
    if (typeof user !== "string" || typeof ai !== "string") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const oid = new ObjectId(id);
    const client = await clientPromise;
    const db = client.db("ducktype");
    const now = new Date();

    // ✅ type the collection
    const conversations: Collection<Conversation> =
      db.collection<Conversation>("conversations");

    const conv = await conversations.findOneAndUpdate(
      { _id: oid },
      {
        $push: { messages: { user, ai, createdAt: now } },
        $set: { updatedAt: now },
        // optional: ensures these exist for new docs if you ever add upsert
        // $setOnInsert: { createdAt: now, messages: [] },
      },
      { returnDocument: "after" }
    );

    if (!conv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const lastMsg = conv.messages[conv.messages.length - 1];

    return NextResponse.json({
      message: {
        ...lastMsg,
        createdAt: lastMsg?.createdAt ? lastMsg.createdAt.toISOString() : null,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
