import clientPromise from "../../../../lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function GET(_req: Request, { params }: { params: any }) {
  try {
    const p = await params;
    const id = p?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const oid = new ObjectId(id);
    const client = await clientPromise;
    const db = client.db("ducktype");
    const conv = await db.collection("conversations").findOne({ _id: oid });
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const transformed = {
      ...conv,
      _id: conv._id?.toString?.(),
      createdAt: conv.createdAt?.toISOString?.() ?? conv.createdAt,
      updatedAt: conv.updatedAt?.toISOString?.() ?? conv.updatedAt,
      messages: Array.isArray(conv.messages)
        ? conv.messages.map((m: any) => ({ ...m, createdAt: m.createdAt?.toISOString?.() ?? m.createdAt }))
        : [],
    };

    return NextResponse.json(transformed);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: any }) {
  try {
    const p = await params;
    const id = p?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const oid = new ObjectId(id);
    const client = await clientPromise;
    const db = client.db("ducktype");
    const res = await db.collection("conversations").deleteOne({ _id: oid });
    if (res.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ deletedId: id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
