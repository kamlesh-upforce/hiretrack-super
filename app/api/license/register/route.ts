import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import License from "@/app/models/license";
import Client from "@/app/models/client";
import { licenseRegisterSchema } from "@/lib/validators";
import { generateLicenseKey } from "@/lib/license";

// POST: Register a new license for a client with machine code
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();
    console.log("BODY: ", body);
    
    // Validate request body
    const validationResult = licenseRegisterSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.message,
        },
        { status: 400 }
      );
    }

    const { machineCode, version, email } = body;

    // Check if a license with the same email and machineCode already exists
    const existingLicense = await License.findOne({ email, machineCode });
    if (existingLicense) {
      return NextResponse.json(
        {
          error: "A license for this email and machine code already exists.",
        },
        { status: 400 }
      );
    }

    // Check if a client exists with this email in the Client collection
    const existingClient = await Client.findOne({ email });
    if (!existingClient) {
      return NextResponse.json(
        {
          error:
            "No Client is registered with this email. Please the client through Super Admin.",
        },
        { status: 400 }
      );
    }

    // Generate a unique license key
    const licenseKey = generateLicenseKey(email, machineCode);

    // Create the license with machine code already bound
    const newLicense = new License({
      licenseKey,
      status: "active",
      machineCode,
      // allowedVersion: version,
      installedVersion: version,
      email,
    });

    await newLicense.save();

    return NextResponse.json({
      message: "License registered successfully",
      license: {
        licenseKey: newLicense.licenseKey,
        email: newLicense.email,
        status: newLicense.status,
        machineCode: newLicense.machineCode,
        // allowedVersion: newLicense.allowedVersion,
        installedVersion: newLicense.installedVersion,
      },
    });
  } catch (error: any) {
    console.error("Error registering license:", error);
    console.log("Error registering license:", error.message);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
