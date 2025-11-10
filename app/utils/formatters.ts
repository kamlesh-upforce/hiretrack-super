export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return "N/A";
  
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return "N/A";
    
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "N/A";
  }
}

export function formatDateShort(dateString: string | Date | undefined | null): string {
  if (!dateString) return "N/A";
  
  try {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return "N/A";
    
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "N/A";
  }
}

export function formatStatus(status: string): {
  label: string;
  className: string;
} {
  const statusMap: Record<string, { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700",
    },
    inactive: {
      label: "Inactive",
      className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700",
    },
    deactivated: {
      label: "Deactivated",
      className: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600",
    },
    revoked: {
      label: "Revoked",
      className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700",
    },
  };

  return (
    statusMap[status.toLowerCase()] || {
      label: status,
      className: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600",
    }
  );
}
