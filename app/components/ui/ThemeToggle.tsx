"use client";

import React from "react";
import { useTheme } from "@/app/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  variant?: "default" | "light";
}

export default function ThemeToggle({ variant = "default" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  const iconColor = variant === "light" 
    ? "text-gray-700 dark:text-gray-300" 
    : "text-white";

  const bgClass = variant === "light"
    ? "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
    : "hover:bg-opacity-80";

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${bgClass}`}
      aria-label="Toggle theme"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? (
        <Moon className={`w-5 h-5 ${iconColor}`} />
      ) : (
        <Sun className={`w-5 h-5 ${iconColor}`} />
      )}
    </button>
  );
}
