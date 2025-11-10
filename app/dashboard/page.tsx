"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Key, CheckCircle, XCircle } from "lucide-react";
import { IClient } from "../models/client";
import { ILicense } from "../models/license";
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
        const [clientsResponse, licensesResponse] = await Promise.all([
          api.get<PaginatedResponse<IClient>>(
            "/api/client/read?page=1&limit=1"
          ),
          api.get<PaginatedResponse<ILicense>>(
            "/api/license/read?page=1&limit=1"
          ),
        ]);

        // Get total counts from pagination
        const totalClients =
          clientsResponse.pagination?.total || 0;
        const totalLicenses =
          licensesResponse.pagination?.total || 0;

        // Fetch all licenses to calculate active count
        // We'll get a large sample to count active licenses
        const allLicensesResponse = await api.get<PaginatedResponse<ILicense>>(
          "/api/license/read?page=1&limit=1000"
        );
        const activeLicenses = allLicensesResponse.data?.filter(
          (l) => l.status === "active"
        ).length || 0;

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

  // Fetch licenses function for ServerDataTable
  const fetchLicenses = useCallback(
    async (params: { page: number; limit: number; search: string }) => {
      const queryParams = new URLSearchParams({
        page: params.page.toString(),
        limit: params.limit.toString(),
      });

      if (params.search) {
        queryParams.append("search", params.search);
      }

      const response = await api.get<PaginatedResponse<ILicense>>(
        `/api/license/read?${queryParams.toString()}`
      );

      return response;
    },
    []
  );

  const handleRevokeLicense = async (license: ILicense) => {
    if (
      !confirm(
        `Are you sure you want to revoke license ${license.licenseKey}? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.post("/api/license/revoke", {
        licenseKey: license.licenseKey,
      });

      // Refresh stats
      const statsResponse = await api.get<PaginatedResponse<ILicense>>(
        "/api/license/read?page=1&limit=1000"
      );
      const activeLicenses = statsResponse.data?.filter(
        (l) => l.status === "active"
      ).length || 0;

      setStats((prev) => ({
        ...prev,
        activeLicenses,
        inactiveLicenses: prev.totalLicenses - activeLicenses,
      }));

      // Show success message or refresh the table
      alert("License revoked successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke license");
    }
  };

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
  const clientColumns: Column<IClient>[] = [
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
      header: "Status",
      sortable: false,
      render: (client) => (
        <StatusBadge status={client.status || "active"} />
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: false,
      render: (client) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(client.createdAt?.toString())}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (client) => (
        <div className="flex justify-end space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/clients/${client._id}`);
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm transition-colors"
          >
            View
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleClientStatus(client);
            }}
            className={`font-medium text-sm transition-colors ${
              (client.status || "active") === "active"
                ? "text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300"
                : "text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
            }`}
            title={(client.status || "active") === "active" ? "Deactivate client" : "Activate client"}
          >
            {(client.status || "active") === "active" ? "Deactivate" : "Activate"}
          </button>
        </div>
      ),
    },
  ];

  // Define columns for licenses table
  const licenseColumns: Column<ILicense>[] = [
    {
      key: "licenseKey",
      header: "License Key",
      sortable: false,
      render: (license) => (
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {license.licenseKey}
        </span>
      ),
    },
    {
      key: "email",
      header: "Client Email",
      sortable: false,
      render: (license) => (
        <span className="text-gray-600 dark:text-gray-400">{license.email}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: false,
      render: (license) => <StatusBadge status={license.status} />,
    },
    {
      key: "installedVersion",
      header: "Version",
      sortable: false,
      render: (license) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {license.installedVersion || "N/A"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: false,
      render: (license) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(license.createdAt?.toString())}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (license) => (
        <div className="flex justify-end space-x-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/licenses/${license._id}`);
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm"
          >
            View
          </button>
          {license.status !== "revoked" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRevokeLicense(license);
              }}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium text-sm"
            >
              Revoke
            </button>
          )}
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
      <div className="mb-6 sm:mb-8">
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

      {/* Licenses Section */}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Licenses
        </h2>
        <ServerDataTable
          columns={licenseColumns}
          loading={false}
          searchable={true}
          searchPlaceholder="Search licenses by key or email..."
          paginated={true}
          itemsPerPage={10}
          fetchData={fetchLicenses}
          onRowClick={(license) =>
            router.push(`/dashboard/licenses/${license._id}`)
          }
          emptyMessage="No licenses found."
        />
      </div>
    </div>
  );
}
