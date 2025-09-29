import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Admin } from "../../models/admin";
import { connectToDatabase } from "@/lib/db";

// POST: Admin registration
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { name, email, password } = await req.json();

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return NextResponse.json(
        { error: "Admin already exists" },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin
    const newAdmin = new Admin({ name, email, password: hashedPassword });
    await newAdmin.save();

    return NextResponse.json({ message: "Admin registered successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
