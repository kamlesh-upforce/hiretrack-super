import { NextResponse } from "next/server";
import Client from "../../../models/client";
import History from "../../../models/history";
import { connectToDatabase } from "@/lib/db";
import { getAdminNameFromRequest } from "@/lib/getAdminFromRequest";

// POST: Create a new client
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email, name, notes } = await req.json();

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
      notes: notes || undefined,
      licenseKey: "",
      machineCode: null,
      currentVersion: null,
    });
    await newClient.save();

    // Get admin name from token
    const adminName = await getAdminNameFromRequest();

    // Log history for client creation
    await History.create({
      entityType: "client",
      entityId: newClient._id.toString(),
      action: "client_created",
      description: `Client created: ${name || email}`,
      newValue: "active",
      notes: notes || undefined,
      createdBy: adminName || undefined,
    });

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
