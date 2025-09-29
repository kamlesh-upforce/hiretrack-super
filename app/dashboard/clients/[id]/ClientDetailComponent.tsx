"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IClient } from "@/app/models/client";
import { ILicense } from "@/app/models/license";

// Define props for the client component
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
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchClientDetails = async () => {
      try {
        setLoading(true);

        // Fetch client details
        const clientResponse = await fetch(`/api/client/read?_id=${id}`);
        if (!clientResponse.ok) {
          throw new Error("Failed to fetch client details");
        }

        const clientData = await clientResponse.json();
        setClient(clientData);

        // Fetch licenses for this client
        const licensesResponse = await fetch(
          `/api/license/read?clientId=${id}`
        );
        if (licensesResponse.ok) {
          const licensesData = await licensesResponse.json();
          setLicenses(Array.isArray(licensesData) ? licensesData[0] : []);
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

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  if (loading) return <div className="container mx-auto p-4">Loading...</div>;
  if (error)
    return (
      <div className="container mx-auto p-4 text-red-500">Error: {error}</div>
    );
  if (!client)
    return <div className="container mx-auto p-4">Client not found</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Client Details</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Client Information */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Client Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-600">Name</p>
            <p className="font-medium text-gray-800">{client.name || "N/A"}</p>
          </div>

          <div>
            <p className="text-gray-600">Email</p>
            <p className="font-medium text-gray-800">{client.email}</p>
          </div>

          {client.machineCode && (
            <div>
              <p className="text-gray-600">Machine Code</p>
              <p className="font-medium text-gray-800">{client.machineCode}</p>
            </div>
          )}

          {client.currentVersion && (
            <div>
              <p className="text-gray-600">Current Version</p>
              <p className="font-medium text-gray-800">
                {client.currentVersion}
              </p>
            </div>
          )}

          <div>
            <p className="text-gray-600">Created At</p>
            <p className="font-medium text-gray-800">
              {formatDate(client.createdAt?.toString())}
            </p>
          </div>

          <div>
            <p className="text-gray-600">Last Updated</p>
            <p className="font-medium text-gray-800">
              {formatDate(client.updatedAt?.toString())}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t pt-4">
          {/* <h3 className="font-medium mb-2 text-gray-800">Actions</h3> */}
          <div className="flex space-x-2">
            {/* <button
              onClick={() =>
                router.push(`/dashboard/licenses/create?clientId=${client._id}`)
              }
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Create License
            </button> */}
            <button
              onClick={() => {
                // Implement edit functionality
                router.push(`/dashboard/clients/edit/${client._id}`);
              }}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Edit Client
            </button>
          </div>
        </div>
      </div>

      {/* Client Licenses */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Client Licenses
        </h2>

        {licenses?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 text-left">License Key</th>
                  <th className="py-2 px-4 text-left">Status</th>
                  <th className="py-2 px-4 text-left">Version</th>
                  <th className="py-2 px-4 text-left">Created</th>
                  <th className="py-2 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((license) => (
                  <tr key={String(license._id)} className="border-t">
                    <td className="py-2 px-4">{license.licenseKey}</td>
                    <td className="py-2 px-4">
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
                    </td>
                    {/* <td className="py-2 px-4">{license.allowedVersion}</td> */}
                    <td className="py-2 px-4">
                      {formatDate(license.createdAt.toString())}
                    </td>
                    <td className="py-2 px-4">
                      <button
                        onClick={() =>
                          router.push(`/dashboard/licenses/${license._id}`)
                        }
                        className="text-blue-500 hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No licenses found for this client.</p>
        )}

        {/* <div className="mt-4">
          <button
            onClick={() =>
              router.push(`/dashboard/licenses/create?clientId=${client._id}`)
            }
            className="text-blue-500 hover:underline"
          >
            Create New License
          </button>
        </div> */}
      </div>
    </div>
  );
}
