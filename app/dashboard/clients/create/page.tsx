"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import FormInput from "@/app/components/forms/FormInput";
import FormTextarea from "@/app/components/forms/FormTextarea";
import ErrorMessage from "@/app/components/ui/ErrorMessage";
import SuccessMessage from "@/app/components/ui/SuccessMessage";
import LoadingSpinner from "@/app/components/ui/LoadingSpinner";
import { api } from "@/app/utils/api";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors({
        ...fieldErrors,
        [name]: "",
      });
    }

    // Clear general error
    if (error) {
      setError("");
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await api.post("/api/client/create", {
        name: formData.name.trim(),
        email: formData.email.trim(),
        notes: formData.notes.trim() || undefined,
      });

      setSuccess("Client created successfully! Redirecting...");

      // Reset form
      setFormData({
        name: "",
        email: "",
        notes: "",
      });

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Create New Client
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Add a new client to the system. All fields marked with * are required.
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        </div>
      )}

      {success && (
        <div className="mb-6">
          <SuccessMessage message={success} />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 transition-colors">
        <form onSubmit={handleSubmit}>
          <FormInput
            label="Client Name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            required
            error={fieldErrors.name}
            placeholder="Enter client name"
            disabled={loading}
          />

          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            error={fieldErrors.email}
            placeholder="client@example.com"
            helperText="This email will be used as a unique identifier"
            disabled={loading}
          />

          <FormTextarea
            label="Notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            placeholder="Additional notes about this client (optional)"
            helperText="Optional: Add any additional information about this client"
            disabled={loading}
          />

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              <span>{loading ? "Creating..." : "Create Client"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
