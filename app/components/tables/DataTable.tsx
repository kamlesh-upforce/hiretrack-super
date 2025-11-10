"use client";

import React, { useMemo, useState } from "react";
import LoadingSpinner from "../ui/LoadingSpinner";
import Pagination from "../ui/Pagination";
import SearchBar from "../ui/SearchBar";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T | string)[];
  paginated?: boolean;
  itemsPerPage?: number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  searchKeys,
  paginated = true,
  itemsPerPage: initialItemsPerPage = 10,
  onRowClick,
  emptyMessage = "No data available",
  className = "",
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | string;
    direction: "asc" | "desc";
  } | null>(null);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchTerm || !searchable) return data;

    const lowerSearchTerm = searchTerm.toLowerCase();
    return data.filter((item) => {
      if (searchKeys) {
        return searchKeys.some((key) => {
          const value = item[key];
          return value?.toString().toLowerCase().includes(lowerSearchTerm);
        });
      }
      // Default: search all string values
      return Object.values(item).some((value) =>
        value?.toString().toLowerCase().includes(lowerSearchTerm)
      );
    });
  }, [data, searchTerm, searchable, searchKeys]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof T];
      const bValue = b[sortConfig.key as keyof T];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortConfig.direction === "asc") {
        return aStr > bStr ? 1 : -1;
      }
      return aStr < bStr ? 1 : -1;
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage, paginated]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleSort = (key: keyof T | string) => {
    if (!columns.find((col) => col.key === key)?.sortable) return;

    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden transition-colors ${className}`}>
      {searchable && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${
                    column.sortable ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" : ""
                  } ${column.className || ""}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable && sortConfig?.key === column.key && (
                      <span className="text-gray-400 dark:text-gray-400">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  {searchTerm ? "No results found" : emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr
                  key={(item as any)._id || index}
                  onClick={() => onRowClick?.(item)}
                  className={`${
                    onRowClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" : ""
                  } transition-colors`}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`px-3 sm:px-6 py-4 text-sm text-gray-900 dark:text-gray-100 ${
                        column.className || ""
                      }`}
                    >
                      {column.render
                        ? column.render(item)
                        : String(item[column.key as keyof T] || "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginated && sortedData.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          itemsPerPage={itemsPerPage}
          totalItems={sortedData.length}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}
    </div>
  );
}

