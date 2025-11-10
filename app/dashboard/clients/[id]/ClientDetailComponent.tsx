"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit } from "lucide-react";
import { IClient } from "@/app/models/client";
import { ILicense } from "@/app/models/license";
import LoadingSpinner from "@/app/components/ui/LoadingSpinner";
import ErrorMessage from "@/app/components/ui/ErrorMessage";
import SuccessMessage from "@/app/components/ui/SuccessMessage";
import DataTable, { Column } from "@/app/components/tables/DataTable";
import { formatDate } from "@/app/utils/formatters";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { api } from "@/app/utils/api";

interface ClientDetailComponentProps {
  id: string;
}

export default function ClientDetailComponent({
  id,
}: ClientDetailComponentProps) {
  const router = useRouter();
  const [client, setClient] = useState<IClient | null>(null);
  const [licenses, setLicenses] = useState<ILicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchClientDetails = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch client details
        const clientData = await api.get<IClient>(`/api/client/read?_id=${id}`);
        setClient(clientData);

        // Fetch licenses for this client
        try {
          const licensesData = await api.get<ILicense[]>(
            `/api/license/read?email=${clientData?.email}`
          );
          // Ensure it's an array
          setLicenses(Array.isArray(licensesData) ? licensesData : []);
        } catch (licenseError) {
          // If no licenses found, set empty array
          setLicenses([]);
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    if (id) {
      fetchClientDetails();
    }
  }, [id]);

  const handleToggleStatus = async () => {
    if (!client) return;

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
      setUpdating(true);
      setError("");
      setSuccess("");

      const response = await api.patch("/api/client/toggle-status", {
        _id: client._id,
        status: newStatus,
      });

      setClient((prev) =>
        prev ? { ...prev, status: newStatus as any } : null
      );
      setSuccess(`Client ${action}d successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} client`);
    } finally {
      setUpdating(false);
    }
  };

  // Define columns for licenses table
  const licenseColumns: Column<ILicense>[] = [
    {
      key: "licenseKey",
      header: "License Key",
      sortable: true,
      render: (license) => (
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {license.licenseKey}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (license) => <StatusBadge status={license.status} />,
    },
    {
      key: "installedVersion",
      header: "Version",
      sortable: true,
      render: (license) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {license.installedVersion || "N/A"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
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
        <div className="flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/licenses/${license._id}`);
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm transition-colors"
          >
            View
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600 text-center">Client not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Client Details
          </h1>
          <p className="text-gray-600 dark:text-gray-400">View and manage client information</p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium flex items-center justify-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        </div>
      )}

      {success && (
        <div className="mb-6">
          <SuccessMessage message={success} onDismiss={() => setSuccess("")} />
        </div>
      )}

      {/* Client Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Client Information
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={handleToggleStatus}
              disabled={updating}
              className={`w-full sm:w-auto px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium flex items-center justify-center space-x-2 ${
                (client.status || "active") === "active"
                  ? "bg-orange-600 dark:bg-orange-700 text-white hover:bg-orange-700 dark:hover:bg-orange-600"
                  : "bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-600"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {updating && <LoadingSpinner size="sm" />}
              <span>
                {updating
                  ? "Updating..."
                  : (client.status || "active") === "active"
                    ? "Deactivate"
                    : "Activate"}
              </span>
            </button>
            <button
              onClick={() => router.push(`/dashboard/clients/edit/${client._id}`)}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium flex items-center justify-center space-x-2"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Client</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Name</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {client.name || "N/A"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {client.email}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</p>
            <div className="mt-1">
              <StatusBadge status={client.status || "active"} />
            </div>
          </div>

          <div className="md:col-span-2">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {client.notes || "No notes available"}
            </p>
          </div>

          {client.machineCode && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Machine Code
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-mono">
                {client.machineCode}
              </p>
            </div>
          )}

          {client.currentVersion && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Current Version
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {client.currentVersion}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Created At</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(client.createdAt?.toString())}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Last Updated
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(client.updatedAt?.toString())}
            </p>
          </div>
        </div>
      </div>

      {/* Client Licenses */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 transition-colors">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Client Licenses ({licenses.length})
        </h2>

        {licenses.length > 0 ? (
          <DataTable
            data={licenses}
            columns={licenseColumns}
            loading={false}
            searchable={true}
            searchPlaceholder="Search licenses..."
            searchKeys={["licenseKey"]}
            paginated={true}
            itemsPerPage={10}
            onRowClick={(license) =>
              router.push(`/dashboard/licenses/${license._id}`)
            }
            emptyMessage="No licenses found"
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No licenses found for this client.</p>
          </div>
        )}
      </div>
    </div>
  );
}
