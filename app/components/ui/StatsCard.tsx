"use client";

import React from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export default function StatsCard({
  title,
  value,
  icon,
  trend,
  className = "",
}: StatsCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 transition-colors ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {trend && (
            <p
              className={`text-xs mt-2 ${
                trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="ml-4 text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</div>
        )}
      </div>
    </div>
  );
}

