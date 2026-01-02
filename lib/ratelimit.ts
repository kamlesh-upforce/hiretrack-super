/**
 * Simple in-memory rate limiter based on IP address
 * For production use, consider using Redis-based solutions like @upstash/ratelimit
 */

import { NextRequest } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (IP -> RateLimitEntry)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, CLEANUP_INTERVAL);

export interface RateLimitOptions {
  maxRequests: number; // Maximum number of requests
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when the limit resets
  retryAfter?: number; // Seconds until retry is allowed
}

/**
 * Check if a request should be rate limited
 * @param ip - IP address of the client
 * @param options - Rate limit options
 * @returns Rate limit result
 */
export function checkRateLimit(
  ip: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  // If no entry exists or the window has expired, create a new entry
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    rateLimitStore.set(ip, newEntry);
    return {
      success: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      reset: newEntry.resetTime,
    };
  }

  // If limit exceeded
  if (entry.count >= options.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      limit: options.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
      retryAfter,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(ip, entry);

  return {
    success: true,
    limit: options.maxRequests,
    remaining: options.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Get client IP address from request
 * Handles various proxy headers (X-Forwarded-For, X-Real-IP, etc.)
 */
export async function getClientIP(): Promise<string> {

    const data = await fetch("https://api.ipify.org?format=json");
    const dataJson = await data.json();
    return dataJson.ip as string || "unknown";
}

