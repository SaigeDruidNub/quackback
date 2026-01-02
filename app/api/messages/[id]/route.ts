import clientPromise from "../../../../lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(_req.url);
    const idFromPath = params?.id ?? url.pathname.split('/').filter(Boolean).pop();
    console.log('DELETE /api/messages/[id] params:', params, 'urlPath', url.pathname, 'idFromPath', idFromPath);
    const id = idFromPath;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch (e) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("ducktype");
    const res = await db.collection("messages").deleteOne({ _id: oid });
    if (res.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ deletedId: id });
  } catch (e: any) {
    console.error("DELETE /api/messages/[id] error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown" }, { status: 500 });
  }
}
