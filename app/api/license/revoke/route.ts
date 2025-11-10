import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import License from "@/app/models/license";

// POST: Revoke a license
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { licenseKey, status } = await req.json();

    if (!licenseKey || !status) {
      return NextResponse.json(
        { error: "License key and status are required" },
        { status: 400 }
      );
    }

    // Find and update the license status to revoked
    const revokedLicense = await License.findOneAndUpdate(
      { licenseKey },
      { status: status },
      { new: true }
    );

    if (!revokedLicense) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "License revoked successfully",
      license: {
        licenseKey: revokedLicense.licenseKey,
        clientId: revokedLicense.clientId,
        status: revokedLicense.status,
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
