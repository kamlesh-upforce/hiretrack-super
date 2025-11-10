"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IClient } from "@/app/models/client";
import FormInput from "@/app/components/forms/FormInput";
import FormTextarea from "@/app/components/forms/FormTextarea";
import ErrorMessage from "@/app/components/ui/ErrorMessage";
import SuccessMessage from "@/app/components/ui/SuccessMessage";
import LoadingSpinner from "@/app/components/ui/LoadingSpinner";
import { api } from "@/app/utils/api";

interface ClientEditFormProps {
  id: string;
}

export default function ClientEditForm({ id }: ClientEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Partial<IClient>>({
    name: "",
    email: "",
    notes: "",
  });

  // Fetch client data
  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const clientData = await api.get<IClient>(`/api/client/read?_id=${id}`);

        setFormData({
          name: clientData.name || "",
          email: clientData.email || "",
          notes: clientData.notes || "",
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch client data");
        setLoading(false);
      }
    };

    if (id) {
      fetchClient();
    }
  }, [id]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

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

    if (!formData.name?.trim()) {
      errors.name = "Name is required";
    }

    if (!formData.email?.trim()) {
      errors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (!validateForm()) {
      setSubmitting(false);
      return;
    }

    try {
      await api.patch("/api/client/update", {
        _id: id,
        name: formData.name,
        email: formData.email,
        notes: formData.notes || undefined,
      });

      setSuccess("Client updated successfully! Redirecting...");

      // Navigate back to client details after a short delay
      setTimeout(() => {
        router.push(`/dashboard/clients/${id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setSubmitting(false);
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

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Edit Client</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Update client information. Fields marked with * are required.
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
            value={formData.name || ""}
            onChange={handleChange}
            required
            error={fieldErrors.name}
            placeholder="Enter client name"
            disabled={submitting}
          />

          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={formData.email || ""}
            onChange={handleChange}
            required
            error={fieldErrors.email}
            placeholder="client@example.com"
            helperText="Email is used as the unique identifier and cannot be changed."
            disabled={submitting}
          />

          <FormTextarea
            label="Notes"
            name="notes"
            value={formData.notes || ""}
            onChange={handleChange}
            rows={4}
            placeholder="Additional notes about this client (optional)"
            helperText="Optional: Add any additional information about this client"
            disabled={submitting}
          />

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/clients/${id}`)}
              disabled={submitting}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
            >
              {submitting && <LoadingSpinner size="sm" />}
              <span>{submitting ? "Updating..." : "Update Client"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
