import { NextResponse } from "next/server";
import Client from "../../../models/client";
import { connectToDatabase } from "@/lib/db";

// DELETE: Remove a client by email
export async function DELETE(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const deletedClient = await Client.findOneAndUpdate({ email }, { status: "deactivated" }, { new: true });
    if (!deletedClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Client deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
