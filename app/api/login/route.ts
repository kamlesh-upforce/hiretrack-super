import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Admin } from "../../models/admin";
import { connectToDatabase } from "@/lib/db";
import { withAuthCookie, signAdminJwtJose } from "@/lib/auth";

// POST: Admin login
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email, password } = await req.json();

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate JWT token using jose
    const token = await signAdminJwtJose({
      adminId: admin._id.toString(),
      email: admin.email,
    });

    // Create response with token in body
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
      },
    });

    // Set the auth cookie
    return withAuthCookie(response, token);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
