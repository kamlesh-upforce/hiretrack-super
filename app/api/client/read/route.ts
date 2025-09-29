import { NextResponse } from "next/server";
import Client from "../../../models/client";
import { connectToDatabase } from "@/lib/db";
import { Types } from "mongoose";

// GET: Retrieve all clients or a specific client by email
export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("_id");
    const email = searchParams.get("email");

    if (email) {
      const client = await Client.findOne({ email });
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(client);
    }

    if (id) {
      const client = await Client.findOne({ _id: new Types.ObjectId(id) });
      console.log("CLIENT: ", client);
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
      console.log("CLKIENT: ", client);
      return NextResponse.json(client);
    }

    const clients = await Client.find();
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
