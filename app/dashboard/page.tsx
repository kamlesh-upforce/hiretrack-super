"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Key, CheckCircle, XCircle } from "lucide-react";
import { IClient } from "../models/client";
import ServerDataTable, { Column } from "../components/tables/ServerDataTable";
import StatsCard from "../components/ui/StatsCard";
import ErrorMessage from "../components/ui/ErrorMessage";
import { formatDate } from "../utils/formatters";
import { StatusBadge } from "../components/ui/StatusBadge";
import { api } from "../utils/api";

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    totalClients: 0,
    totalLicenses: 0,
    activeLicenses: 0,
    inactiveLicenses: 0,
  });

  // Fetch stats on component mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        setError("");

        // Fetch stats (we'll get totals from paginated responses)
        const clientsResponse = await api.get<PaginatedResponse<IClient>>(
          "/api/client/read?page=1&limit=1"
        );

        // Get total counts from pagination
        const totalClients = clientsResponse.pagination?.total || 0;

        // Fetch all clients to calculate license stats
        const allClientsResponse = await api.get<PaginatedResponse<IClient & { licenseKey?: string | null; licenseStatus?: string | null }>>(
          "/api/client/read?page=1&limit=1000"
        );
        
        const clientsWithLicenses = allClientsResponse.data || [];
        const totalLicenses = clientsWithLicenses.filter(c => (c as any).licenseKey).length;
        const activeLicenses = clientsWithLicenses.filter(
          (c) => (c as any).licenseStatus === "active"
        ).length;

        setStats({
          totalClients,
          totalLicenses,
          activeLicenses,
          inactiveLicenses: totalLicenses - activeLicenses,
        });

        setStatsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Fetch clients function for ServerDataTable
  const fetchClients = useCallback(
    async (params: { page: number; limit: number; search: string }) => {
      const queryParams = new URLSearchParams({
        page: params.page.toString(),
        limit: params.limit.toString(),
      });

      if (params.search) {
        queryParams.append("search", params.search);
      }

      const response = await api.get<PaginatedResponse<IClient>>(
        `/api/client/read?${queryParams.toString()}`
      );

      return response;
    },
    []
  );

  const [clientRefreshKey, setClientRefreshKey] = useState(0);

  const handleToggleClientStatus = async (client: IClient) => {
    const currentStatus = client.status || "active";
    const newStatus = currentStatus === "active" ? "deactivated" : "active";
    const action = newStatus === "active" ? "activate" : "deactivate";

    if (
      !confirm(
        `Are you sure you want to ${action} client ${client.name || client.email}?`
      )
    ) {
      return;
    }

    try {
      await api.patch("/api/client/toggle-status", {
        _id: client._id,
        status: newStatus,
      });

      // Trigger refresh by updating key
      setClientRefreshKey((prev) => prev + 1);
      
      // Update stats
      const statsResponse = await api.get<PaginatedResponse<IClient>>(
        "/api/client/read?page=1&limit=1"
      );
      setStats((prev) => ({
        ...prev,
        totalClients: statsResponse.pagination?.total || prev.totalClients,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} client`);
    }
  };

  // Define columns for clients table
  const clientColumns: Column<IClient & { licenseKey?: string | null; licenseStatus?: string | null; installedVersion?: string | null }>[] = [
    {
      key: "name",
      header: "Name",
      sortable: false,
      render: (client) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {client.name || "N/A"}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: false,
      render: (client) => (
        <span className="text-gray-600 dark:text-gray-400">{client.email}</span>
      ),
    },
    {
      key: "status",
      header: "Client Status",
      sortable: false,
      render: (client) => (
        <StatusBadge status={client.status || "active"} />
      ),
    },
    {
      key: "licenseKey",
      header: "License Key",
      sortable: false,
      render: (client) => (
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {(client as any).licenseKey || "N/A"}
        </span>
      ),
    },
    {
      key: "licenseStatus",
      header: "License Status",
      sortable: false,
      render: (client) => {
        const licenseStatus = (client as any).licenseStatus;
        if (!licenseStatus) return <span className="text-gray-500 dark:text-gray-400">N/A</span>;
        return <StatusBadge status={licenseStatus} />;
      },
    },
    {
      key: "installedVersion",
      header: "Installed Version",
      sortable: false,
      render: (client) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {(client as any).installedVersion || "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (client) => (
        <div className="flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/clients/${client._id}`);
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm transition-colors px-3 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            View
          </button>
        </div>
      ),
    },
  ];


  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your clients and licenses from here
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        </div>
      )}

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatsCard
            title="Total Clients"
            value={stats.totalClients}
            icon={<Users className="w-8 h-8 text-gray-500 dark:text-gray-400" />}
          />
          <StatsCard
            title="Total Licenses"
            value={stats.totalLicenses}
            icon={<Key className="w-8 h-8 text-gray-500 dark:text-gray-400" />}
          />
          <StatsCard
            title="Active Licenses"
            value={stats.activeLicenses}
            icon={<CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400" />}
          />
          <StatsCard
            title="Inactive Licenses"
            value={stats.inactiveLicenses}
            icon={<XCircle className="w-8 h-8 text-red-500 dark:text-red-400" />}
          />
        </div>
      )}

      {/* Clients Section */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Clients
          </h2>
          <button
            onClick={() => router.push("/dashboard/clients/create")}
            className="w-full sm:w-auto bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium flex items-center justify-center space-x-2"
          >
            <Users className="w-4 h-4" />
            <span>Add Client</span>
          </button>
        </div>
        <ServerDataTable
          key={clientRefreshKey}
          columns={clientColumns}
          loading={false}
          searchable={true}
          searchPlaceholder="Search clients by name or email..."
          paginated={true}
          itemsPerPage={10}
          fetchData={fetchClients}
          onRowClick={(client) =>
            router.push(`/dashboard/clients/${client._id}`)
          }
          emptyMessage="No clients found. Create your first client to get started."
        />
      </div>
    </div>
  );
}
