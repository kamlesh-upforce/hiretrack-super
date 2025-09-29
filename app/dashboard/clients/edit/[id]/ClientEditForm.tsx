"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IClient } from "@/app/models/client";

interface ClientEditFormProps {
  id: string;
}

export default function ClientEditForm({ id }: ClientEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState<Partial<IClient>>({
    name: "",
    email: "",
    machineCode: "",
    currentVersion: "",
  });

  // Fetch client data
  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/client/read?_id=${id}`);

        if (!response.ok) {
          throw new Error("Failed to fetch client data");
        }

        const clientData = await response.json();
        setFormData({
          name: clientData.name || "",
          email: clientData.email || "",
          machineCode: clientData.machineCode || "",
          currentVersion: clientData.currentVersion || "",
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    if (id) {
      fetchClient();
    }
  }, [id]);

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      // Validate email (simple validation)
      if (!formData.email || !formData.email.includes("@")) {
        throw new Error("Please enter a valid email address");
      }

      // Submit update to API
      const response = await fetch("/api/client/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          _id: id,
          name: formData.name,
          email: formData.email,
          machineCode: formData.machineCode || undefined,
          currentVersion: formData.currentVersion || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update client");
      }

      setSuccess("Client updated successfully");

      // Navigate back to client details after a short delay
      setTimeout(() => {
        router.push(`/dashboard/clients/${id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading client data...</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Edit Client</h1>
        <button
          onClick={() => router.push(`/dashboard/clients/${id}`)}
          className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow">
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="name">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="email">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Email is used as the unique identifier and cannot be changed.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="machineCode">
            Machine Code
          </label>
          <input
            type="text"
            id="machineCode"
            name="machineCode"
            value={formData.machineCode}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2" htmlFor="currentVersion">
            Current Version
          </label>
          <input
            type="text"
            id="currentVersion"
            name="currentVersion"
            value={formData.currentVersion}
            onChange={handleChange}
            placeholder="e.g. 1.0.0"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? "Updating..." : "Update Client"}
          </button>
        </div>
      </form>
    </div>
  );
}
