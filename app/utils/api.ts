const API_BASE = ""; // Relative URLs for Next.js API routes

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: "include",
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(errorData.error || "Request failed");
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

// API helper functions
export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number>) => {
    const queryString = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return apiRequest<T>(`${endpoint}${queryString}`, { method: "GET" });
  },

  post: <T>(endpoint: string, data?: unknown) => {
    return apiRequest<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  patch: <T>(endpoint: string, data?: unknown) => {
    return apiRequest<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete: <T>(endpoint: string) => {
    return apiRequest<T>(endpoint, { method: "DELETE" });
  },
};

