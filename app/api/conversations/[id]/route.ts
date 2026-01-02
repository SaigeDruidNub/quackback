// PATCH: Add or update the "Aha Moment" for a conversation
export async function PATCH(req: Request, { params }: { params: any }) {
  try {
    const p = await params;
    const id = p?.id;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (!userId)
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
        { status: 400 }
      );
    }
    const oid = new ObjectId(id);
    const client = await clientPromise;
    const db = client.db("ducktype");
    const now = new Date().toISOString();
    const result = await db
      .collection("conversations")
      .findOneAndUpdate(
        { _id: oid, userId },
        {
          $set: { ahaMoment: { text, createdAt: now }, updatedAt: new Date() },
        },
        { returnDocument: "after" }
      );
    const conv = (result && "value" in result ? result.value : result) || null;
    if (!conv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ahaMoment: conv.ahaMoment });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
import clientPromise from "../../../../lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function GET(req: Request, { params }: { params: any }) {
  try {
    const p = await params;
    const id = p?.id;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (!userId)
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const oid = new ObjectId(id);
    const client = await clientPromise;
    const db = client.db("ducktype");
    const conv = await db
      .collection("conversations")
      .findOne({ _id: oid, userId });
    if (!conv)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const transformed = {
      ...conv,
      _id: conv._id?.toString?.(),
      createdAt: conv.createdAt?.toISOString?.() ?? conv.createdAt,
      updatedAt: conv.updatedAt?.toISOString?.() ?? conv.updatedAt,
      messages: Array.isArray(conv.messages)
        ? conv.messages.map((m: any) => ({
            ...m,
            createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
          }))
        : [],
    };

    return NextResponse.json(transformed);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: any }) {
  try {
    const p = await params;
    const id = p?.id;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (!userId)
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const oid = new ObjectId(id);
    const client = await clientPromise;
    const db = client.db("ducktype");
    const res = await db
      .collection("conversations")
      .deleteOne({ _id: oid, userId });
    if (res.deletedCount === 0)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ deletedId: id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
