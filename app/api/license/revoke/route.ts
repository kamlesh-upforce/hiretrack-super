import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import License from "@/app/models/license";
import History from "@/app/models/history";
import { getAdminNameFromRequest } from "@/lib/getAdminFromRequest";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { licenseKey, reason } = await req.json();

    if (!licenseKey) {
      return NextResponse.json(
        { error: "License key is required" },
        { status: 400 }
      );
    }

    const license = await License.findOne({ licenseKey });

    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    if (license.status === "revoked") {
      return NextResponse.json(
        { error: "License is already revoked" },
        { status: 400 }
      );
    }

    const previousStatus = license.status;
    const adminName = await getAdminNameFromRequest().catch(() => undefined);
    license.status = "revoked";
    license.revoked = {
      reason: reason?.trim() || undefined,
      revokedAt: new Date(),
      revokedBy: adminName || "system",
    };

    await license.save();

    await History.create({
      entityType: "license",
      entityId: license._id.toString(),
      action: "license_revoked",
      description: `License revoked for ${license.email}`,
      oldValue: previousStatus,
      newValue: "revoked",
      notes: reason?.trim() || undefined,
      createdBy: adminName || undefined,
    });

    return NextResponse.json({
      message: "License revoked successfully",
      license: {
        licenseKey: license.licenseKey,
        status: license.status,
        revoked: license.revoked,
      },
    });
  } catch (error) {
    console.error("Error revoking license:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
