import { NextResponse } from "next/server";
import Client from "../../../models/client";
import License from "../../../models/license";
import History from "../../../models/history";
import { connectToDatabase } from "@/lib/db";
import { Types } from "mongoose";

// PATCH: Toggle client status (activate/deactivate)
export async function PATCH(req: Request) {
  try {
    await connectToDatabase();
    const { _id, status, notes } = await req.json();

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
    const oldStatus = client.status || "active";
    const newStatus = status || (oldStatus === "active" ? "deactivated" : "active");

    // Update client status
    const updatedClient = await Client.findOneAndUpdate(
      { _id: new Types.ObjectId(_id) },
      { status: newStatus },
      { new: true }
    );

    // Log history for client status change
    await History.create({
      entityType: "client",
      entityId: _id.toString(),
      action: "status_changed",
      description: `Client status changed from ${oldStatus} to ${newStatus}`,
      oldValue: oldStatus,
      newValue: newStatus,
      notes: notes || undefined,
    });

    // If client is being deactivated, also deactivate all licenses associated with their email
    if (newStatus === "deactivated") {
      const licensesToUpdate = await License.find({ email: client.email });
      const updatedLicenses = await License.updateMany(
        { email: client.email },
        { status: "inactive" }
      );

      // Log history for each license that was deactivated
      for (const license of licensesToUpdate) {
        if (license.status !== "inactive") {
          await History.create({
            entityType: "license",
            entityId: license._id.toString(),
            action: "status_changed",
            description: `License deactivated due to client deactivation`,
            oldValue: license.status,
            newValue: "inactive",
            notes: `Automatically deactivated when client ${client.email} was deactivated`,
          });
        }
      }
      
      return NextResponse.json({
        message: `Client deactivated successfully. ${updatedLicenses.modifiedCount} license(s) deactivated.`,
        client: updatedClient,
        licensesUpdated: updatedLicenses.modifiedCount,
      });
    }
    
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

