"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IClient } from "../models/client";
import { ILicense } from "../models/license";

export default function Dashboard() {
  const router = useRouter();
  const [clients, setClients] = useState<IClient[]>([]);
  const [licenses, setLicenses] = useState<ILicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch clients and licenses on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch clients
        const clientsResponse = await fetch("/api/client/read");
        if (!clientsResponse.ok) {
          throw new Error("Failed to fetch clients");
        }
        const clientsData = await clientsResponse.json();

        // Fetch licenses
        const licensesResponse = await fetch("/api/license/read");
        if (!licensesResponse.ok) {
          throw new Error("Failed to fetch licenses");
        }
        const licensesData = await licensesResponse.json();

        setClients(clientsData);
        setLicenses(licensesData);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="container mx-auto p-4">
      {/* <h1 className="text-2xl font-bold mb-6">Dashboard</h1> */}

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clients Section */}
          <div className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Clients ({clients.length})
              </h2>
              <button
                onClick={() => router.push("/dashboard/clients/create")}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Add Client
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 text-left">Name</th>
                    <th className="py-2 px-4 text-left">Email</th>
                    <th className="py-2 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={String(client._id)} className="border-t">
                      <td className="py-2 px-4">{client.name}</td>
                      <td className="py-2 px-4">{client.email}</td>
                      <td className="py-2 px-4">
                        <button
                          onClick={() =>
                            router.push(`/dashboard/clients/${client._id}`)
                          }
                          className="text-blue-500 hover:underline mr-2"
                        >
                          View
                        </button>
                        {/* <button
                          onClick={() =>
                            router.push(
                              `/dashboard/licenses/create?clientId=${client._id}`
                            )
                          }
                          className="text-green-500 hover:underline"
                        >
                          Create License
                        </button> */}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Licenses Section */}
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Licenses ({licenses.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 text-left">License Key</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Version</th>
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
                        <button
                          onClick={() =>
                            router.push(`/dashboard/licenses/${license._id}`)
                          }
                          className="text-blue-500 hover:underline mr-2"
                        >
                          View
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              confirm(
                                "Are you sure you want to revoke this license?"
                              )
                            ) {
                              await fetch("/api/license/revoke", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  licenseKey: license.licenseKey,
                                }),
                              });
                              // Refresh the data
                              router.refresh();
                            }
                          }}
                          className="text-red-500 hover:underline"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
