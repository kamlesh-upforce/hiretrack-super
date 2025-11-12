import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as jose from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change";
export const COOKIE_NAME = process.env.COOKIE_NAME || "admin_token";

// Create a function to get the secret key for jose
// This ensures we create a new TextEncoder each time, which is safer for Edge Runtime
function getSecretKey() {
  const textEncoder = new TextEncoder();
  return textEncoder.encode(JWT_SECRET);
}

export async function hashPassword(plain: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AdminJwtPayload {
  adminId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// For API routes (server-side), we can still use jsonwebtoken
export function signAdminJwt(
  payload: Omit<AdminJwtPayload, "iat" | "exp">
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

// For middleware (Edge Runtime), we use jose
export async function verifyAdminJwt(
  token: string
): Promise<AdminJwtPayload | null> {
  try {
    // Use jose for verification in Edge Runtime
    const secretKey = getSecretKey();
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as unknown as AdminJwtPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// For API routes, we can use this function to verify tokens
export function verifyAdminJwtNode(token: string): AdminJwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminJwtPayload;
  } catch (error) {
    console.error("Token verification failed (Node):", error);
    return null;
  }
}

// For API routes, we can use jose to sign tokens too
export async function signAdminJwtJose(
  payload: Omit<AdminJwtPayload, "iat" | "exp">
): Promise<string> {
  const secretKey = getSecretKey();
  const token = await new jose.SignJWT(payload as Record<string, any>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secretKey);

  return token;
}

export function withAuthCookie(res: NextResponse, token: string): NextResponse {
  // Set the cookie with appropriate options
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Only use HTTPS in production
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}

export function withoutAuthCookie(res: NextResponse): NextResponse {
  res.cookies.delete(COOKIE_NAME);
  return res;
}

export async function getAuthPayloadFromCookies(): Promise<AdminJwtPayload | null> {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return null;
    // We can't use verifyAdminJwt here directly because it's async
    // This function is used in server components which can't be async
    // So we use the Node version
    return verifyAdminJwtNode(token);
  } catch (error) {
    console.error("Error getting auth payload from cookies:", error);
    return null;
  }
}
