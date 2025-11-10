"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8 transition-colors">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-6">
                  <AlertTriangle className="w-20 h-20 text-red-500 dark:text-red-400" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Critical Error
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                  A critical error occurred that prevented the application from loading.
                </p>
                {error.message && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-800 dark:text-red-300 font-mono break-all">
                      {error.message}
                    </p>
                  </div>
                )}
                {error.digest && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={reset}
                  className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Try Again</span>
                </button>
                <button
                  onClick={() => (window.location.href = "/")}
                  className="inline-flex items-center justify-center space-x-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium"
                >
                  <Home className="w-5 h-5" />
                  <span>Go to Home</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

