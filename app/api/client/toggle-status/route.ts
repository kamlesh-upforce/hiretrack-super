import { NextResponse } from "next/server";
import Client from "../../../models/client";
import { connectToDatabase } from "@/lib/db";
import { Types } from "mongoose";

// PATCH: Toggle client status (activate/deactivate)
export async function PATCH(req: Request) {
  try {
    await connectToDatabase();
    const { _id, status } = await req.json();

    if (!_id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    if (status && !["active", "deactivated"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be 'active' or 'deactivated'" },
        { status: 400 }
      );
    }

    // Find client
    const client = await Client.findOne({ _id: new Types.ObjectId(_id) });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Toggle status if not provided, or set to provided status
    const newStatus = status || (client.status === "active" ? "deactivated" : "active");

    // Update client status
    const updatedClient = await Client.findOneAndUpdate(
      { _id: new Types.ObjectId(_id) },
      { status: newStatus },
      { new: true }
    );

    return NextResponse.json({
      message: `Client ${newStatus === "active" ? "activated" : "deactivated"} successfully`,
      client: updatedClient,
    });
  } catch (error) {
    console.error("Error toggling client status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

