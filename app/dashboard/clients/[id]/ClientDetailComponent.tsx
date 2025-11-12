"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Clock, Key, User, Mail, Calendar, FileText, Cpu, CheckCircle, XCircle } from "lucide-react";
import { IClient } from "@/app/models/client";
import { ILicense } from "@/app/models/license";
import LoadingSpinner from "@/app/components/ui/LoadingSpinner";
import ErrorMessage from "@/app/components/ui/ErrorMessage";
import SuccessMessage from "@/app/components/ui/SuccessMessage";
import NoteDialog from "@/app/components/ui/NoteDialog";
import { formatDate } from "@/app/utils/formatters";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { api } from "@/app/utils/api";

interface IHistory {
  _id: string;
  entityType: "client" | "license";
  entityId: string;
  action: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

interface IValidationHistory {
  _id: string;
  licenseKey: string;
  email: string;
  machineCode: string;
  valid: boolean;
  message?: string;
  installedVersion?: string;
  licenseId?: string;
  createdAt: Date;
}

const idToString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toString" in value &&
    typeof (value as { toString: () => string }).toString === "function"
  ) {
    return (value as { toString: () => string }).toString();
  }

  return "";
};

interface ClientDetailComponentProps {
  id: string;
}

export default function ClientDetailComponent({
  id,
}: ClientDetailComponentProps) {
  const router = useRouter();
  const [client, setClient] = useState<IClient | null>(null);
  const [licenses, setLicenses] = useState<ILicense[]>([]);
  const [history, setHistory] = useState<IHistory[]>([]);
  const [validationHistory, setValidationHistory] = useState<IValidationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showLicenseNoteDialog, setShowLicenseNoteDialog] = useState(false);
  const [updatingLicense, setUpdatingLicense] = useState(false);
  const [licenseActionType, setLicenseActionType] = useState<"activate" | "deactivate" | "revoke" | null>(null);
  const licenseActionTypeRef = useRef<"activate" | "deactivate" | "revoke" | null>(null);

  useEffect(() => {
    const fetchClientDetails = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch client details
        const clientData = await api.get<IClient>(`/api/client/read?_id=${id}`);
        setClient(clientData);

        // Fetch licenses for this client
        let licensesList: ILicense[] = [];
        try {
          const licensesData = await api.get<ILicense[]>(
            `/api/license/read?email=${clientData?.email}`
          );
          licensesList = Array.isArray(licensesData) ? licensesData : [];
          setLicenses(licensesList);
        } catch {
          setLicenses([]);
        }

        // Fetch history for this client
        let clientHistory: IHistory[] = [];
        try {
          const historyData = await api.get<IHistory[]>(
            `/api/history/read?entityType=client&entityId=${id}`
          );
          clientHistory = Array.isArray(historyData) ? historyData : [];
        } catch {
          // If no history found, set empty array
        }

        // Fetch history for all licenses of this client
        let licenseHistory: IHistory[] = [];
        if (licensesList.length > 0) {
          try {
            const licenseIds = licensesList
              .map((l) => idToString(l._id))
              .filter(Boolean);
            const licenseHistoryPromises = licenseIds.map((licenseId) =>
              api.get<IHistory[]>(
                `/api/history/read?entityType=license&entityId=${licenseId}`
              )
            );
            const licenseHistoryResults = await Promise.all(licenseHistoryPromises);
            licenseHistory = licenseHistoryResults.flat();
          } catch {
            // Ignore errors for license history
          }
        }

        // Combine and sort all history
        const allHistory = [...clientHistory, ...licenseHistory].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setHistory(allHistory);

        // Fetch validation history for this client's email
        try {
          const validationHistoryData = await api.get<IValidationHistory[]>(
            `/api/validation-history/read?email=${clientData?.email}&limit=50`
          );
          setValidationHistory(Array.isArray(validationHistoryData) ? validationHistoryData : []);
        } catch {
          // If no validation history found, set empty array
          setValidationHistory([]);
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

  const handleToggleStatus = async (note?: string) => {
    if (!client) return;

    const currentStatus = client.status || "active";
    const newStatus = currentStatus === "active" ? "deactivated" : "active";
    const action = newStatus === "active" ? "activate" : "deactivate";

    try {
      setUpdating(true);
      setError("");
      setSuccess("");

      await api.patch("/api/client/toggle-status", {
        _id: client._id,
        status: newStatus,
        notes: note || undefined,
      });

      // Refetch client data to get the updated status
      const updatedClient = await api.get<IClient>(`/api/client/read?_id=${id}`);
      setClient(updatedClient);
      setSuccess(`Client ${action}d successfully`);

      // Refresh license details
      try {
        const refreshedLicenses = await api.get<ILicense[]>(
          `/api/license/read?email=${updatedClient.email}`
        );
        setLicenses(Array.isArray(refreshedLicenses) ? refreshedLicenses : []);
      } catch {
        // Keep previous licenses if fetch fails
      }

      // Refetch history for client and licenses
      try {
        const historyData = await api.get<IHistory[]>(
          `/api/history/read?entityType=client&entityId=${id}`
        );
        const clientHistory = Array.isArray(historyData) ? historyData : [];
        
        // Also fetch license history
        if (licenses.length > 0) {
          const licenseIds = licenses
            .map((l) => idToString(l._id))
            .filter(Boolean);
          const licenseHistoryPromises = licenseIds.map((licenseId) =>
            api.get<IHistory[]>(
              `/api/history/read?entityType=license&entityId=${licenseId}`
            )
          );
          const licenseHistoryResults = await Promise.all(licenseHistoryPromises);
          const licenseHistory = licenseHistoryResults.flat();
          
          const allHistory = [...clientHistory, ...licenseHistory].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setHistory(allHistory);
        } else {
          setHistory(clientHistory);
        }
      } catch {
        // Ignore errors
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} client`);
    } finally {
      setUpdating(false);
    }
  };

  const initiateToggleStatus = () => {
    if (!client) return;
    setShowNoteDialog(true);
  };

  const handleNoteConfirm = (note: string) => {
    setShowNoteDialog(false);
    handleToggleStatus(note.trim() || undefined);
  };

  const handleLicenseToggleStatus = async (note?: string, actionType?: "activate" | "deactivate" | "revoke") => {
    if (!primaryLicense) {
      console.error("handleLicenseToggleStatus: No primary license");
      setError("No license found");
      return;
    }

    // Use provided actionType or fallback to state
    const currentActionType = actionType || licenseActionType;
    if (!currentActionType) {
      console.error("handleLicenseToggleStatus: No action type provided");
      setError("No action type specified");
      return;
    }

    let newStatus: "active" | "inactive" | "revoked";
    let action: string;

    switch (currentActionType) {
      case "activate":
        newStatus = "active";
        action = "activate";
        break;
      case "deactivate":
        newStatus = "inactive";
        action = "deactivate";
        break;
      case "revoke":
        newStatus = "revoked";
        action = "revoke";
        break;
      default:
        return;
    }

    try {
      setUpdatingLicense(true);
      setError("");
      setSuccess("");

      const licenseId = idToString(primaryLicense._id);
      console.log("Changing license status:", { licenseId, newStatus, action: currentActionType, note });

      const response = await api.patch("/api/license/toggle-status", {
        _id: licenseId,
        status: newStatus,
        notes: note || undefined,
      });

      console.log("License status change response:", response);

      // Refetch license data, history, and validation history
      try {
        const refreshedLicenses = await api.get<ILicense[]>(
          `/api/license/read?email=${client?.email}`
        );
        const updatedLicenses = Array.isArray(refreshedLicenses) ? refreshedLicenses : [];
        setLicenses(updatedLicenses);

        // Refetch history for licenses
        const licenseIds = updatedLicenses
          .map((l) => idToString(l._id))
          .filter(Boolean);
        
        if (licenseIds.length > 0) {
          const licenseHistoryPromises = licenseIds.map((licenseId) =>
            api.get<IHistory[]>(
              `/api/history/read?entityType=license&entityId=${licenseId}`
            )
          );
          const licenseHistoryResults = await Promise.all(licenseHistoryPromises);
          const licenseHistory = licenseHistoryResults.flat();

          // Also get client history
          const clientHistoryData = await api.get<IHistory[]>(
            `/api/history/read?entityType=client&entityId=${id}`
          );
          const clientHistory = Array.isArray(clientHistoryData) ? clientHistoryData : [];

          const allHistory = [...clientHistory, ...licenseHistory].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setHistory(allHistory);

          // Refetch validation history
          try {
            const validationHistoryData = await api.get<IValidationHistory[]>(
              `/api/validation-history/read?email=${client?.email}&limit=50`
            );
            setValidationHistory(Array.isArray(validationHistoryData) ? validationHistoryData : []);
          } catch {
            // Ignore validation history errors
          }
        } else {
          // If no licenses, just get client history
          const clientHistoryData = await api.get<IHistory[]>(
            `/api/history/read?entityType=client&entityId=${id}`
          );
          const clientHistory = Array.isArray(clientHistoryData) ? clientHistoryData : [];
          setHistory(clientHistory);
        }
      } catch {
        // Keep previous licenses if fetch fails
      }

      setSuccess(`License ${action}d successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} license`);
    } finally {
      setUpdatingLicense(false);
    }
  };

  const initiateLicenseStatusChange = (actionType: "activate" | "deactivate" | "revoke") => {
    if (!primaryLicense) return;
    licenseActionTypeRef.current = actionType;
    setLicenseActionType(actionType);
    setShowLicenseNoteDialog(true);
  };

  const handleLicenseNoteConfirm = (note: string) => {
    setShowLicenseNoteDialog(false);
    // Use ref to get the action type (avoids React state timing issues)
    const actionType = licenseActionTypeRef.current;
    licenseActionTypeRef.current = null;
    setLicenseActionType(null);
    // Call the handler with the captured action type
    if (!actionType) {
      console.error("No action type found when confirming license status change");
      setError("Failed to change license status: No action type specified");
      return;
    }
    if (!primaryLicense) {
      console.error("No primary license found when confirming license status change");
      setError("Failed to change license status: No license found");
      return;
    }
    handleLicenseToggleStatus(note.trim() || undefined, actionType);
  };

  const primaryLicense = useMemo(() => licenses[0] ?? null, [licenses]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-gray-600 dark:text-gray-400 text-center">Client not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-3 sm:py-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {client.name || client.email}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Client & License Management
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={initiateToggleStatus}
            disabled={updating}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              (client.status || "active") === "active"
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {updating ? "Updating..." : (client.status || "active") === "active" ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => router.push(`/dashboard/clients/edit/${client._id}`)}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        </div>
      )}

      {success && (
        <div className="mb-3">
          <SuccessMessage message={success} onDismiss={() => setSuccess("")} />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Left Column - Client Info */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Client Information Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Client Information
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <User className="w-3 h-3" />
                  <span>Name</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {client.name || "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Mail className="w-3 h-3" />
                  <span>Email</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">
                  {client.email}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span>Status</span>
                </div>
                <StatusBadge status={client.status || "active"} />
              </div>
              {client.machineCode && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Cpu className="w-3 h-3" />
                    <span>Machine Code</span>
                  </div>
                  <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100 break-all">
                    {client.machineCode}
                  </p>
                </div>
              )}
              {client.currentVersion && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span>Current Version</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {client.currentVersion}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="w-3 h-3" />
                  <span>Created</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(client.createdAt?.toString())}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="w-3 h-3" />
                  <span>Last Updated</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(client.updatedAt?.toString())}
                </p>
              </div>
            </div>
            {client.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  <FileText className="w-3 h-3" />
                  <span>Notes</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {client.notes}
                </p>
              </div>
            )}
          </div>

          {/* License Information Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  License Information
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {primaryLicense && (
                  <>
                    <StatusBadge status={primaryLicense.status} />
                    <div className="flex items-center gap-2">
                      {primaryLicense.status === "active" && (
                        <>
                          <button
                            onClick={() => initiateLicenseStatusChange("deactivate")}
                            disabled={updatingLicense}
                            className="px-3 py-1 text-xs rounded-lg font-medium bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Deactivate
                          </button>
                          <button
                            onClick={() => initiateLicenseStatusChange("revoke")}
                            disabled={updatingLicense}
                            className="px-3 py-1 text-xs rounded-lg font-medium bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                      {primaryLicense.status === "inactive" && (
                        <>
                          <button
                            onClick={() => initiateLicenseStatusChange("activate")}
                            disabled={updatingLicense}
                            className="px-3 py-1 text-xs rounded-lg font-medium bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => initiateLicenseStatusChange("revoke")}
                            disabled={updatingLicense}
                            className="px-3 py-1 text-xs rounded-lg font-medium bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                      {primaryLicense.status === "revoked" && (
                        <button
                          onClick={() => initiateLicenseStatusChange("activate")}
                          disabled={updatingLicense}
                          className="px-3 py-1 text-xs rounded-lg font-medium bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {primaryLicense ? (
              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    <Key className="w-3 h-3" />
                    <span>License Key</span>
                  </div>
                  <p className="font-mono text-xs sm:text-sm text-gray-900 dark:text-gray-100 break-all">
                    {primaryLicense.licenseKey}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
                    <StatusBadge status={primaryLicense.status} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Version</div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {primaryLicense.installedVersion || "N/A"}
                    </p>
                  </div>
                  {primaryLicense.machineCode && (
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Machine Code</div>
                      <p className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
                        {primaryLicense.machineCode}
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Created</div>
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(primaryLicense.createdAt?.toString())}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Updated</div>
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(primaryLicense.updatedAt?.toString())}
                    </p>
                  </div>
                  {primaryLicense.lastValidatedAt && (
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Last Validated</div>
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(primaryLicense.lastValidatedAt?.toString())}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                <Key className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No License</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This client does not have a license yet
                </p>
              </div>
            )}
          </div>

          {/* Validation History Card */}
          {primaryLicense && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Validation History
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({validationHistory.length})
                </span>
              </div>

              {validationHistory.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {validationHistory.map((entry) => (
                    <div
                      key={entry._id}
                      className={`border rounded-lg p-2.5 text-xs ${
                        entry.valid
                          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                          : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {entry.valid ? (
                            <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                          )}
                          <span className={`font-medium ${
                            entry.valid
                              ? "text-green-800 dark:text-green-300"
                              : "text-red-800 dark:text-red-300"
                          }`}>
                            {entry.valid ? "Valid" : "Invalid"}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(entry.createdAt?.toString())}
                        </span>
                      </div>
                      <div className="space-y-1 text-[10px] text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-1">
                          <Key className="w-2.5 h-2.5" />
                          <span className="font-mono break-all">{entry.licenseKey}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="w-2.5 h-2.5" />
                          <span>{entry.email || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Cpu className="w-2.5 h-2.5" />
                          <span className="font-mono">{entry.machineCode}</span>
                        </div>
                        {entry.installedVersion && (
                          <div className="text-gray-600 dark:text-gray-400">
                            Version: {entry.installedVersion}
                          </div>
                        )}
                        {entry.message && (
                          <div className="text-red-600 dark:text-red-400 italic mt-1">
                            {entry.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                  <CheckCircle className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">No validation history</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - History */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Activity History
              </h2>
            </div>

            {history.length > 0 ? (
              <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                {history.map((entry) => (
                  <div
                    key={entry._id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/40"
                  >
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">
                      {entry.description}
                    </p>
                    {entry.oldValue && entry.newValue && (
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-1.5">
                        <span className="font-medium">{entry.oldValue}</span> → <span className="font-medium">{entry.newValue}</span>
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 italic mb-2">
                        {entry.notes}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                          {entry.entityType === "client" ? "Client" : "License"}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                          {entry.action.replace("_", " ")}
                        </span>
                        {entry.createdBy && (
                          <span className="text-[10px] text-gray-600 dark:text-gray-400">
                            by <span className="font-medium text-gray-900 dark:text-gray-200">{entry.createdBy}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(entry.createdAt?.toString())}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">No history available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client Status Note Dialog */}
      <NoteDialog
        isOpen={showNoteDialog}
        onClose={() => {
          setShowNoteDialog(false);
        }}
        onConfirm={handleNoteConfirm}
        title={
          (client.status || "active") === "active"
            ? "Deactivate Client"
            : "Activate Client"
        }
        message={
          (client.status || "active") === "active"
            ? `Are you sure you want to deactivate ${client.name || client.email}? You can add a note to explain the reason.`
            : `Are you sure you want to activate ${client.name || client.email}? You can add a note to explain the reason.`
        }
        placeholder="Add a note or remark about this status change (optional)..."
        confirmText="Confirm"
        cancelText="Cancel"
      />

      {/* License Status Note Dialog */}
      <NoteDialog
        isOpen={showLicenseNoteDialog}
        onClose={() => {
          setShowLicenseNoteDialog(false);
          licenseActionTypeRef.current = null;
          setLicenseActionType(null);
        }}
        onConfirm={handleLicenseNoteConfirm}
        title={
          licenseActionType === "activate"
            ? "Activate License"
            : licenseActionType === "deactivate"
            ? "Deactivate License"
            : "Revoke License"
        }
        message={
          licenseActionType === "activate"
            ? `Are you sure you want to activate this license? You can add a note to explain the reason.`
            : licenseActionType === "deactivate"
            ? `Are you sure you want to deactivate this license? You can add a note to explain the reason.`
            : `Are you sure you want to revoke this license? This action is permanent and cannot be undone. You can add a note to explain the reason.`
        }
        placeholder="Add a note or remark about this license status change (optional)..."
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </div>
  );
}
