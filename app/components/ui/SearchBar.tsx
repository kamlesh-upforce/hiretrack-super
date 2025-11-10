"use client";

import React from "react";
import { Search, X } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  isSearching?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  isSearching = false,
}: SearchBarProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
      />
      {isSearching && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <LoadingSpinner size="sm" />
        </div>
      )}
      {!isSearching && value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          aria-label="Clear search"
        >
          <X className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
        </button>
      )}
    </div>
  );
}
