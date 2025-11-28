import { NextResponse } from "next/server";
import License from "../../../models/license";
import History from "../../../models/history";
import { connectToDatabase } from "@/lib/db";
import { Types } from "mongoose";
import { getAdminNameFromRequest } from "@/lib/getAdminFromRequest";

// PATCH: Toggle license status (activate/inactivate)
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

    if (license.status === "revoked") {
      return NextResponse.json(
        { error: "Revoked licenses cannot change status" },
        { status: 400 }
      );
    }

    // Determine new status
    const oldStatus = license.status;
    let newStatus: string;
    
    if (status) {
      if (!["active", "inactive"].includes(status)) {
        return NextResponse.json(
          { error: "Status must be 'active', 'inactive'" },
          { status: 400 }
        );
      }
      newStatus = status;
    } else {
      // Toggle between active and inactive
      newStatus = oldStatus === "active" ? "inactive" : "active";
    }

    // Update license status
    const updatedLicense = await License.findOneAndUpdate(
      query,
      { status: newStatus },
      { new: true }
    );

    // Get admin name from token
    const adminName = await getAdminNameFromRequest();

    // Log history for license status change
    await History.create({
      entityType: "license",
      entityId: updatedLicense._id.toString(),
      action: "status_changed",
      description: `License status changed from ${oldStatus} to ${newStatus}`,
      oldValue: oldStatus,
      newValue: newStatus,
      notes: notes || undefined,
      createdBy: adminName || undefined,
    });

    return NextResponse.json({
      message: `License ${newStatus === "active" ? "activated" : "deactivated" } successfully`,
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

