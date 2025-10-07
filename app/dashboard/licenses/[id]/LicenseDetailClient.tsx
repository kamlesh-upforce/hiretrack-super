"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ILicense } from "@/app/models/license";
import { IClient } from "@/app/models/client";

// Define props for the client component
interface LicenseDetailClientProps {
  id: string;
}

export default function LicenseDetailClient({ id }: LicenseDetailClientProps) {
  const router = useRouter();

  const [license, setLicense] = useState<ILicense | null>(null);
  const [client, setClient] = useState<IClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("");

  useEffect(() => {
    const fetchLicenseDetails = async () => {
      try {
        setLoading(true);

        // Fetch license details
        const licenseResponse = await fetch(`/api/license/read?licenseKey=${id}`);
        if (!licenseResponse.ok) {
          throw new Error("Failed to fetch license details");
        }

        const licenseData = await licenseResponse.json();
        setLicense(licenseData);
        setStatusUpdate(licenseData.status);
        // Fetch client details
        const clientResponse = await fetch(
          `/api/client/read?email=${licenseData.email}`
        );
        if (!clientResponse.ok) {
          throw new Error("Failed to fetch client details");
        }

        const clientData = await clientResponse.json();
        setClient(clientData);

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    if (id) {
      fetchLicenseDetails();
    }
  }, [id]);

  const handleStatusChange = async () => {
    try {
      const response = await fetch("/api/license/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          licenseKey: license?.licenseKey,
          status: statusUpdate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update license status");
      }

      const updatedLicense = await response.json();
      setLicense(updatedLicense.license);
      alert("License status updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleDownloadLicense = () => {
    try {
      // Create license.json content
      const licenseData = {
        licenseKey: license?.licenseKey,
        status: license?.status,
        // allowedVersion: license?.allowedVersion,
        machineCode: license?.machineCode || "",
        createdAt: license?.createdAt,
        clientName: client?.name || "",
        clientEmail: client?.email || "",
      };

      // Convert to JSON string
      const licenseJson = JSON.stringify(licenseData, null, 2);

      // Create a blob and download link
      const blob = new Blob([licenseJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `license-${license?.licenseKey}.json`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download license file");
      console.error(err);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  if (loading) return <div className="container mx-auto p-4">Loading...</div>;
  if (error)
    return (
      <div className="container mx-auto p-4 text-red-500">Error: {error}</div>
    );
  if (!license)
    return <div className="container mx-auto p-4">License not found</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">License Details</h1>
        <div className="flex space-x-2">
          <button
            onClick={handleDownloadLicense}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download License
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          License Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-600">License Key</p>
            <p className="font-medium text-gray-800">{license.licenseKey}</p>
          </div>

          <div>
            <p className="text-gray-600">Status</p>
            <p className="font-medium">
              <span
                className={`px-2 py-1 rounded text-xs ${
                  license.status === "active"
                    ? "bg-green-100 text-green-800"
                    : license.status === "inactive"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {license.status}
              </span>
            </p>
          </div>

          {/* <div>
            <p className="text-gray-600">Allowed Version</p>
            <p className="font-medium text-gray-800">
              {license.allowedVersion}
            </p>
          </div> */}

          <div>
            <p className="text-gray-600">Installed Version</p>
            <p className="font-medium text-gray-800">
              {license.installedVersion || "Not installed"}
            </p>
          </div>

          <div>
            <p className="text-gray-600">Machine Code</p>
            <p className="font-medium text-gray-800">
              {license.machineCode || "Not bound to any machine"}
            </p>
          </div>

          {/* Expiry date is commented out in the model */}

          <div>
            <p className="text-gray-600">Created At</p>
            <p className="font-medium text-gray-800">
              {formatDate(license.createdAt.toString())}
            </p>
          </div>

          <div>
            <p className="text-gray-600">Last Updated</p>
            <p className="font-medium text-gray-800">
              {formatDate(license.updatedAt.toString())}
            </p>
          </div>
        </div>

        {/* Status Update Form */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2 text-gray-800">
            Update License Status
          </h3>
          <div className="flex items-center">
            <select
              value={statusUpdate}
              onChange={(e) => setStatusUpdate(e.target.value)}
              className="mr-2 px-3 py-2 border rounded"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="revoked">Revoked</option>
            </select>
            <button
              onClick={handleStatusChange}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Update Status
            </button>
          </div>
        </div>
      </div>

      {/* Client Information */}
      {client && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Client Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Name</p>
              <p className="font-medium text-gray-800">{client.name}</p>
            </div>

            <div>
              <p className="text-gray-600">Email</p>
              <p className="font-medium text-gray-800">{client.email}</p>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={() => router.push(`/dashboard/clients/${client._id}`)}
              className="text-blue-500 hover:underline"
            >
              View Client Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
