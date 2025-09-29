import { NextResponse } from "next/server";
import Client from "../../../models/client";
import { connectToDatabase } from "@/lib/db";

// POST: Create a new client
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email, name } = await req.json();

    // Check if client already exists
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return NextResponse.json(
        { error: "Client already exists" },
        { status: 400 }
      );
    }

    // Create new client
    const newClient = new Client({
      email,
      name,
      licenseKey: "",
      machineCode: null,
      currentVersion: null,
    });
    await newClient.save();

    return NextResponse.json({
      message: "Client created successfully",
      client: newClient,
    });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
