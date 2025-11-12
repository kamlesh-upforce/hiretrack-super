import { cookies } from "next/headers";
import { verifyAdminJwtNode, COOKIE_NAME } from "./auth";
import { Admin } from "@/app/models/admin";
import { connectToDatabase } from "./db";

/**
 * Get admin information from the request token
 * Returns the admin name or null if not found
 */
export async function getAdminNameFromRequest(): Promise<string | null> {
  try {
    await connectToDatabase();
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    
    if (!token) {
      return null;
    }

    const payload = verifyAdminJwtNode(token);
    if (!payload || !payload.adminId) {
      return null;
    }

    // Fetch admin from database to get the name
    const admin = await Admin.findById(payload.adminId);
    if (!admin) {
      return null;
    }

    return admin.name;
  } catch (error) {
    console.error("Error getting admin name from request:", error);
    return null;
  }
}

