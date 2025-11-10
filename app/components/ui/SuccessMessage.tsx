"use client";

import React from "react";

interface SuccessMessageProps {
  message: string;
  className?: string;
  onDismiss?: () => void;
}

export default function SuccessMessage({
  message,
  className = "",
  onDismiss,
}: SuccessMessageProps) {
  return (
    <div
      className={`bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-600 text-green-700 dark:text-green-400 p-4 rounded-md transition-colors ${className}`}
      role="alert"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <svg
            className="w-5 h-5 mr-2"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <p className="font-medium">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-green-700 hover:text-green-900 ml-4"
            aria-label="Dismiss success message"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

