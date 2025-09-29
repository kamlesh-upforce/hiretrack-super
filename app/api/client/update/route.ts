import { NextResponse } from "next/server";
import Client from "../../../models/client";
import { connectToDatabase } from "@/lib/db";
import { Types } from "mongoose";

// PATCH: Update client details
export async function PATCH(req: Request) {
  try {
    await connectToDatabase();
    const { email, _id, ...updateData } = await req.json();

    // Find and update client by email or ID
    let query = {};
    if (_id) {
      query = { _id: new Types.ObjectId(_id) };
    } else if (email) {
      query = { email };
    } else {
      return NextResponse.json(
        { error: "Either email or _id is required" },
        { status: 400 }
      );
    }

    // Find and update client
    const updatedClient = await Client.findOneAndUpdate(query, updateData, {
      new: true,
    });

    if (!updatedClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Client updated successfully",
      client: updatedClient,
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
