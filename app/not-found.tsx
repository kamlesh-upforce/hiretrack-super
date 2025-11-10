"use client";

import React from "react";
import Link from "next/link";
import { Home, ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8 transition-colors">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <FileQuestion className="w-24 h-24 text-gray-400 dark:text-gray-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl font-bold text-gray-300 dark:text-gray-700">404</span>
              </div>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Page Not Found
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            The page you requested may have been moved, deleted, or doesn&apos;t exist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium"
          >
            <Home className="w-5 h-5" />
            <span>Go to Dashboard</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}

