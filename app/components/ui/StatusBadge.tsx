"use client";

import React from "react";
import { formatStatus } from "@/app/utils/formatters";

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = formatStatus(status);
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

