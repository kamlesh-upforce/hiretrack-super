"use client";

import React, { useState, useEffect } from "react";
import LoadingSpinner from "../ui/LoadingSpinner";
import Pagination from "../ui/Pagination";
import SearchBar from "../ui/SearchBar";
import { useDebounce } from "../../hooks/useDebounce";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface ServerDataTableProps<T> {
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  paginated?: boolean;
  itemsPerPage?: number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  // Server-side props
  fetchData: (params: {
    page: number;
    limit: number;
    search: string;
  }) => Promise<{
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;
}

export default function ServerDataTable<T extends Record<string, any>>({
  columns,
  loading: externalLoading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  paginated = true,
  itemsPerPage: initialItemsPerPage = 10,
  onRowClick,
  emptyMessage = "No data available",
  className = "",
  fetchData,
}: ServerDataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: initialItemsPerPage,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Fetch data when page, itemsPerPage, or search changes
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await fetchData({
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearchTerm,
        });

        setData(result.data);
        setPagination(result.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, fetchData]);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      // Still debouncing, don't reset yet
      return;
    }
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm, searchTerm, currentPage]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const isLoading = loading || externalLoading;

  return (
    <div
      className={`bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden transition-colors ${className}`}
    >
      {searchable && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
          />
          {searchTerm !== debouncedSearchTerm && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Searching...
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-600 text-red-700 dark:text-red-400 p-3 rounded">
            {error}
          </div>
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
                    column.className || ""
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center"
                >
                  <LoadingSpinner size="lg" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  {debouncedSearchTerm
                    ? "No results found"
                    : emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={(item as any)._id || index}
                  onClick={() => onRowClick?.(item)}
                  className={`${
                    onRowClick
                      ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                      : ""
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

      {paginated && !isLoading && data.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          itemsPerPage={itemsPerPage}
          totalItems={pagination.total}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}
    </div>
  );
}

