import { NextResponse } from "next/server";
import License from "../../../models/license";
import History from "../../../models/history";
import { connectToDatabase } from "@/lib/db";
import { Types } from "mongoose";

// PATCH: Toggle license status (activate/inactivate/revoke)
export async function PATCH(req: Request) {
  try {
    await connectToDatabase();
    const { _id, licenseKey, status, notes } = await req.json();

    if (!_id && !licenseKey) {
      return NextResponse.json(
        { error: "License ID or license key is required" },
        { status: 400 }
      );
    }

    // Find license by ID or license key
    let query = {};
    if (_id) {
      query = { _id: new Types.ObjectId(_id) };
    } else if (licenseKey) {
      query = { licenseKey };
    }

    const license = await License.findOne(query);

    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    // Determine new status
    const oldStatus = license.status;
    let newStatus: string;
    
    if (status) {
      if (!["active", "inactive", "revoked"].includes(status)) {
        return NextResponse.json(
          { error: "Status must be 'active', 'inactive', or 'revoked'" },
          { status: 400 }
        );
      }
      newStatus = status;
    } else {
      // Toggle between active and inactive (don't auto-toggle to revoked)
      newStatus = oldStatus === "active" ? "inactive" : "active";
    }

    // Update license status
    const updatedLicense = await License.findOneAndUpdate(
      query,
      { status: newStatus },
      { new: true }
    );

    // Log history for license status change
    await History.create({
      entityType: "license",
      entityId: updatedLicense._id.toString(),
      action: "status_changed",
      description: `License status changed from ${oldStatus} to ${newStatus}`,
      oldValue: oldStatus,
      newValue: newStatus,
      notes: notes || undefined,
    });

    return NextResponse.json({
      message: `License ${newStatus === "active" ? "activated" : newStatus === "inactive" ? "deactivated" : "revoked"} successfully`,
      license: updatedLicense,
    });
  } catch (error) {
    console.error("Error toggling license status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

