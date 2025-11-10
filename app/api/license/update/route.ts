import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import License from "@/app/models/license";
import { licenseUpdateSchema } from "@/lib/validators";
import { generateLicenseKey } from "@/lib/license";
import Client from "@/app/models/client";

// PATCH: Update license details
export async function PATCH(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // Extract license key from the request
    const { licenseKey, ...updateData } = body;

    // Handle empty string for expiryDate
    if (updateData.expiryDate === "") {
      updateData.expiryDate = null;
    }

    if (!licenseKey) {
      return NextResponse.json(
        { error: "License key is required" },
        { status: 400 }
      );
    }

    // Validate update data
    const validationResult = licenseUpdateSchema.safeParse({
      ...updateData,
      licenseKey,
    });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid update data",
          details: validationResult.error.message,
        },
        { status: 400 }
      );
    }
    if (updateData.email) {
      // Check if a client exists with this email in the Client collection
      const existingClient = await Client.findOne({ email: updateData.email });
      if (!existingClient || existingClient.status === "deactivated") {
        return NextResponse.json(
          {
            error:
              "No Client is registered with this email. Please the client through Super Admin.",
          },
          { status: 400 }
        );
      }
    }
    // Find and update the license
    // Update the license
    const updatedLicense = await License.findOneAndUpdate(
      { licenseKey },
      updateData,
      { new: true }
    );

    if (updatedLicense) {
      // Generate a new license key (assuming generateLicenseKey is available)
      // You may need to import generateLicenseKey from your license utility
      // e.g., import { generateLicenseKey } from "@/lib/license";
      const { email, machineCode } = updatedLicense;
      // If either is missing, fallback to previous values or handle error
      if (email && machineCode) {
        const newLicenseKey = generateLicenseKey(email, machineCode);
        updatedLicense.licenseKey = newLicenseKey;
        await updatedLicense.save();
        // Attach newLicenseKey to response (handled outside this selection)
        // Optionally, you could return updatedLicense here if needed
        // e.g., return { updatedLicense, newLicenseKey }
        // But per the rest of the handler, just update the document
        // and let the response below pick up the new key
        // (You may want to update the response to include newLicenseKey)
        // e.g., return NextResponse.json({ ..., licenseKey: newLicenseKey })
        return NextResponse.json({
          message: "License updated successfully",
          newLicenseKey: newLicenseKey,
          newMachineCode: updateData.machineCode,
          email: updateData.email,
        });
      }
    }

    if (!updatedLicense) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    // return NextResponse.json({
    //   message: "License updated successfully",
    //   // license: updatedLicense,
    // });
  } catch (error: any) {
    console.error("Error updating license:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
