import { NextResponse } from "next/server";
import { verifyLicenseKey } from "@/lib/license";

// POST: Verify a license key
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { licenseKey, email, machineCode } = body;

    if (!licenseKey || !email || !machineCode) {
      return NextResponse.json(
        { error: "licenseKey, email, and machineCode are required" },
        { status: 400 }
      );
    }

    // Verify the license key
    const result = verifyLicenseKey(licenseKey, email, machineCode);

    if (result.valid) {
      return NextResponse.json({
        valid: true,
        nonce: result.nonce,
      });
    } else {
      return NextResponse.json(
        {
          valid: false,
          reason: result.reason,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error verifying license key:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

