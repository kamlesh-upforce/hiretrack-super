"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, ArrowLeft, ArrowRight } from "lucide-react";
import { ILicense } from "@/app/models/license";
import { IClient } from "@/app/models/client";
import LoadingSpinner from "@/app/components/ui/LoadingSpinner";
import ErrorMessage from "@/app/components/ui/ErrorMessage";
import SuccessMessage from "@/app/components/ui/SuccessMessage";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { formatDate } from "@/app/utils/formatters";
import { api } from "@/app/utils/api";

interface LicenseDetailClientProps {
  id: string;
}

export default function LicenseDetailClient({
  id,
}: LicenseDetailClientProps) {
  const router = useRouter();
  const [license, setLicense] = useState<ILicense | null>(null);
  const [client, setClient] = useState<IClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("");

  useEffect(() => {
    const fetchLicenseDetails = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch license details by ID
        const licenseData = await api.get<ILicense>(
          `/api/license/read?licenseKey=${id}`
        );
        setLicense(licenseData);
        setStatusUpdate(licenseData.status);

        // Fetch client details
        try {
          const clientData = await api.get<IClient>(
            `/api/client/read?email=${licenseData.email}`
          );
          setClient(clientData);
        } catch (clientError) {
          // Client might not exist, that's okay
          console.log("Client not found for this license");
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch license details");
        setLoading(false);
      }
    };

    if (id) {
      fetchLicenseDetails();
    }
  }, [id]);

  const handleStatusChange = async () => {
    if (!license) return;

    try {
      setUpdating(true);
      setError("");
      setSuccess("");

      const response = await api.patch("/api/license/update", {
        licenseKey: license.licenseKey,
        status: statusUpdate,
      });

      setLicense((prev) =>
        prev ? { ...prev, status: statusUpdate as any } : null
      );
      setSuccess("License status updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update license status");
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadLicense = () => {
    if (!license) return;

    try {
      const licenseData = {
        licenseKey: license.licenseKey,
        status: license.status,
        machineCode: license.machineCode || "",
        createdAt: license.createdAt,
        clientName: client?.name || "",
        clientEmail: client?.email || "",
      };

      const licenseJson = JSON.stringify(licenseData, null, 2);
      const blob = new Blob([licenseJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `license-${license.licenseKey}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download license file");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error && !license) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-gray-600 dark:text-gray-400 text-center">
            License not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            License Details
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage license information
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={handleDownloadLicense}
            className="w-full sm:w-auto bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium flex items-center justify-center space-x-2"
          >
            <Download className="w-5 h-5" />
            <span>Download License</span>
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
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

      {/* License Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 transition-colors">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
          License Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              License Key
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-mono break-all">
              {license.licenseKey}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Status
            </p>
            <div className="mt-1">
              <StatusBadge status={license.status} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Installed Version
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {license.installedVersion || "Not installed"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Machine Code
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-mono">
              {license.machineCode || "Not bound to any machine"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Created At
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(license.createdAt?.toString())}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Last Updated
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(license.updatedAt?.toString())}
            </p>
          </div>
        </div>

        {/* Status Update Form */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="font-medium mb-4 text-gray-900 dark:text-gray-100">
            Update License Status
          </h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <select
              value={statusUpdate}
              onChange={(e) => setStatusUpdate(e.target.value)}
              disabled={updating}
              className="flex-1 sm:flex-initial px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="revoked">Revoked</option>
            </select>
            <button
              onClick={handleStatusChange}
              disabled={updating || statusUpdate === license.status}
              className="w-full sm:w-auto bg-blue-600 dark:bg-blue-700 text-white px-6 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
            >
              {updating && <LoadingSpinner size="sm" />}
              <span>{updating ? "Updating..." : "Update Status"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Client Information */}
      {client && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Client Information
            </h2>
            <button
              onClick={() => router.push(`/dashboard/clients/${client._id}`)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm transition-colors flex items-center space-x-1"
            >
              <span>View Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Name
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {client.name || "N/A"}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Email
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {client.email}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
