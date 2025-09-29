"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateClient() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/client/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create client");
      }

      setSuccess("Client created successfully");

      // Reset form
      setFormData({
        name: "",
        email: "",
        notes: "",
      });

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Create New Client
      </h1>

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

      <form
        onSubmit={handleSubmit}
        className="bg-white  p-6 rounded shadow border border-gray-200 dark:border-gray-700"
      >
        <div className="mb-4">
          <label className="block mb-2 font-medium" htmlFor="name">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white   focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-medium" htmlFor="email">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white    focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mb-6">
          <label className="block  mb-2 font-medium" htmlFor="notes">
            Notes <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white   focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            spellCheck={false}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold`}
          >
            {loading ? "Creating..." : "Create Client"}
          </button>
        </div>
      </form>
    </div>
  );
}
