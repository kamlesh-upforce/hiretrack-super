"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Clock,
  Key,
  User,
  Mail,
  Calendar,
  FileText,
  Cpu,
  CheckCircle,
  XCircle,
  ShieldOff,
} from "lucide-react";
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
  const [validationHistory, setValidationHistory] = useState<
    IValidationHistory[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showLicenseNoteDialog, setShowLicenseNoteDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [updatingLicense, setUpdatingLicense] = useState(false);
  const [revokingLicense, setRevokingLicense] = useState(false);
  const [licenseActionType, setLicenseActionType] = useState<
    "activate" | "deactivate" | null
  >(null);
  const licenseActionTypeRef = useRef<"activate" | "deactivate" | null>(null);

  // Pagination states
  const [validationHistorySkip, setValidationHistorySkip] = useState(0);
  const [validationHistoryHasMore, setValidationHistoryHasMore] = useState(true);
  const [loadingMoreValidationHistory, setLoadingMoreValidationHistory] =
    useState(false);
  const validationHistoryObserverRef = useRef<HTMLDivElement>(null);

  const [historySkip, setHistorySkip] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const historyObserverRef = useRef<HTMLDivElement>(null);

  const [revokedLicensesDisplayCount, setRevokedLicensesDisplayCount] =
    useState(5);
  const revokedLicensesObserverRef = useRef<HTMLDivElement>(null);

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

        // Fetch history for this client (initial load)
        let clientHistory: IHistory[] = [];
        try {
          const historyResponse = await api.get<{
            data: IHistory[];
            pagination: { skip: number; limit: number; total: number; hasMore: boolean };
          }>(`/api/history/read?entityType=client&entityId=${id}&limit=20&skip=0`);
          if (historyResponse && typeof historyResponse === "object" && "data" in historyResponse) {
            clientHistory = Array.isArray(historyResponse.data) ? historyResponse.data : [];
            setHistorySkip(historyResponse.pagination.skip + historyResponse.pagination.limit);
            setHistoryHasMore(historyResponse.pagination.hasMore);
          } else {
            // Backward compatibility
            clientHistory = Array.isArray(historyResponse) ? historyResponse : [];
          }
        } catch {
          // If no history found, set empty array
        }

        // Fetch history for all licenses of this client (initial load)
        let licenseHistory: IHistory[] = [];
        if (licensesList.length > 0) {
          try {
            const licenseIds = licensesList
              .map((l) => idToString(l._id))
              .filter(Boolean);
            const licenseHistoryPromises = licenseIds.map((licenseId) =>
              api.get<{
                data: IHistory[];
                pagination: { skip: number; limit: number; total: number; hasMore: boolean };
              }>(`/api/history/read?entityType=license&entityId=${licenseId}&limit=20&skip=0`)
            );
            const licenseHistoryResults = await Promise.all(
              licenseHistoryPromises
            );
            licenseHistory = licenseHistoryResults.flatMap((result) => {
              if (result && typeof result === "object" && "data" in result) {
                return Array.isArray(result.data) ? result.data : [];
              }
              return Array.isArray(result) ? result : [];
            });
          } catch {
            // Ignore errors for license history
          }
        }

        // Combine and sort all history
        const allHistory = [...clientHistory, ...licenseHistory].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setHistory(allHistory);

        // Fetch validation history for this client's email (initial load)
        try {
          const validationHistoryResponse = await api.get<{
            data: IValidationHistory[];
            pagination: { skip: number; limit: number; total: number; hasMore: boolean };
          }>(`/api/validation-history/read?email=${clientData?.email}&limit=20&skip=0`);
          if (validationHistoryResponse && typeof validationHistoryResponse === "object" && "data" in validationHistoryResponse) {
            const validationData = Array.isArray(validationHistoryResponse.data) ? validationHistoryResponse.data : [];
            setValidationHistory(validationData);
            setValidationHistorySkip(validationHistoryResponse.pagination.skip + validationHistoryResponse.pagination.limit);
            setValidationHistoryHasMore(validationHistoryResponse.pagination.hasMore);
          } else {
            // Backward compatibility
            setValidationHistory(Array.isArray(validationHistoryResponse) ? validationHistoryResponse : []);
          }
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
      const updatedClient = await api.get<IClient>(
        `/api/client/read?_id=${id}`
      );
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

      // Refresh history and licenses using the refresh function
      await refreshLicenseAndHistory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} client`
      );
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

  const refreshLicenseAndHistory = async () => {
    if (!client) {
      return;
    }
    try {
      const refreshedLicenses = await api.get<ILicense[]>(
        `/api/license/read?email=${client.email}`
      );
      const updatedLicenses = Array.isArray(refreshedLicenses)
        ? refreshedLicenses
        : [];
      setLicenses(updatedLicenses);

      const licenseIds = updatedLicenses
        .map((l) => idToString(l._id))
        .filter(Boolean);

      // Reset pagination and fetch initial data
      let clientHistory: IHistory[] = [];
      try {
        const clientHistoryResponse = await api.get<{
          data: IHistory[];
          pagination: { skip: number; limit: number; total: number; hasMore: boolean };
        }>(`/api/history/read?entityType=client&entityId=${id}&limit=20&skip=0`);
        if (clientHistoryResponse && typeof clientHistoryResponse === "object" && "data" in clientHistoryResponse) {
          clientHistory = Array.isArray(clientHistoryResponse.data) ? clientHistoryResponse.data : [];
          setHistorySkip(clientHistoryResponse.pagination.skip + clientHistoryResponse.pagination.limit);
          setHistoryHasMore(clientHistoryResponse.pagination.hasMore);
        } else {
          clientHistory = Array.isArray(clientHistoryResponse) ? clientHistoryResponse : [];
        }
      } catch {
        clientHistory = [];
      }

      if (licenseIds.length > 0) {
        const licenseHistoryPromises = licenseIds.map((licenseId) =>
          api.get<{
            data: IHistory[];
            pagination: { skip: number; limit: number; total: number; hasMore: boolean };
          }>(`/api/history/read?entityType=license&entityId=${licenseId}&limit=20&skip=0`)
        );
        const licenseHistoryResults = await Promise.all(
          licenseHistoryPromises
        );
        const licenseHistory = licenseHistoryResults.flatMap((result) => {
          if (result && typeof result === "object" && "data" in result) {
            return Array.isArray(result.data) ? result.data : [];
          }
          return Array.isArray(result) ? result : [];
        });

        const allHistory = [...clientHistory, ...licenseHistory].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setHistory(allHistory);

        try {
          const validationHistoryResponse = await api.get<{
            data: IValidationHistory[];
            pagination: { skip: number; limit: number; total: number; hasMore: boolean };
          }>(`/api/validation-history/read?email=${client.email}&limit=20&skip=0`);
          if (validationHistoryResponse && typeof validationHistoryResponse === "object" && "data" in validationHistoryResponse) {
            const validationData = Array.isArray(validationHistoryResponse.data) ? validationHistoryResponse.data : [];
            setValidationHistory(validationData);
            setValidationHistorySkip(validationHistoryResponse.pagination.skip + validationHistoryResponse.pagination.limit);
            setValidationHistoryHasMore(validationHistoryResponse.pagination.hasMore);
          } else {
            setValidationHistory(Array.isArray(validationHistoryResponse) ? validationHistoryResponse : []);
          }
        } catch {
          // Ignore validation history errors
        }
      } else {
        setHistory(clientHistory);
      }

      // Reset revoked licenses display count
      setRevokedLicensesDisplayCount(5);
    } catch {
      // Keep existing state if refresh fails
    }
  };

  const handleLicenseToggleStatus = async (
    note?: string,
    actionType?: "activate" | "deactivate" 
  ) => {
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

    let newStatus: "active" | "inactive";
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
      default:
        return;
    }

    try {
      setUpdatingLicense(true);
      setError("");
      setSuccess("");

      const licenseId = idToString(primaryLicense._id);
      console.log("Changing license status:", {
        licenseId,
        newStatus,
        action: currentActionType,
        note,
      });

      const response = await api.patch("/api/license/toggle-status", {
        _id: licenseId,
        status: newStatus,
        notes: note || undefined,
      });

      console.log("License status change response:", response);

      await refreshLicenseAndHistory();
      setSuccess(`License ${action}d successfully`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} license`
      );
    } finally {
      setUpdatingLicense(false);
    }
  };

  const initiateLicenseStatusChange = (
    actionType: "activate" | "deactivate" 
  ) => {
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
      console.error(
        "No action type found when confirming license status change"
      );
      setError("Failed to change license status: No action type specified");
      return;
    }
    if (!primaryLicense) {
      console.error(
        "No primary license found when confirming license status change"
      );
      setError("Failed to change license status: No license found");
      return;
    }
    handleLicenseToggleStatus(note.trim() || undefined, actionType);
  };

  const initiateLicenseRevoke = () => {
    if (!primaryLicense || primaryLicense.status === "revoked") {
      return;
    }
    setShowRevokeDialog(true);
  };

  const handleLicenseRevoke = async (note?: string) => {
    if (!primaryLicense) {
      setError("No license found");
      return;
    }

    try {
      setRevokingLicense(true);
      setError("");
      setSuccess("");

      await api.post("/api/license/revoke", {
        licenseKey: primaryLicense.licenseKey,
        reason: note || undefined,
      });

      await refreshLicenseAndHistory();
      setSuccess("License revoked successfully");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to revoke license"
      );
    } finally {
      setRevokingLicense(false);
    }
  };

  const handleRevokeNoteConfirm = (note: string) => {
    setShowRevokeDialog(false);
    handleLicenseRevoke(note.trim() || undefined);
  };

  const primaryLicense = useMemo(() => {
    const nonRevoked = licenses.find((license) => license.status !== "revoked");
    return nonRevoked ?? licenses[0] ?? null;
  }, [licenses]);

  const revokedLicenses = useMemo(
    () => licenses.filter((license) => license.status === "revoked"),
    [licenses]
  );

  const displayedRevokedLicenses = useMemo(
    () => revokedLicenses.slice(0, revokedLicensesDisplayCount),
    [revokedLicenses, revokedLicensesDisplayCount]
  );

  // Load more validation history
  const loadMoreValidationHistory = useCallback(async () => {
    if (!client || loadingMoreValidationHistory || !validationHistoryHasMore) {
      return;
    }

    try {
      setLoadingMoreValidationHistory(true);
      const response = await api.get<{
        data: IValidationHistory[];
        pagination: { skip: number; limit: number; total: number; hasMore: boolean };
      }>(`/api/validation-history/read?email=${client.email}&limit=20&skip=${validationHistorySkip}`);

      if (response && typeof response === "object" && "data" in response) {
        const newData = Array.isArray(response.data) ? response.data : [];
        setValidationHistory((prev) => [...prev, ...newData]);
        setValidationHistorySkip(response.pagination.skip + response.pagination.limit);
        setValidationHistoryHasMore(response.pagination.hasMore);
      }
    } catch (err) {
      console.error("Error loading more validation history:", err);
    } finally {
      setLoadingMoreValidationHistory(false);
    }
  }, [client, loadingMoreValidationHistory, validationHistoryHasMore, validationHistorySkip]);

  // Load more activity history
  const loadMoreHistory = useCallback(async () => {
    if (!client || loadingMoreHistory || !historyHasMore) {
      return;
    }

    try {
      setLoadingMoreHistory(true);

      // Fetch more client history
      const clientHistoryResponse = await api.get<{
        data: IHistory[];
        pagination: { skip: number; limit: number; total: number; hasMore: boolean };
      }>(`/api/history/read?entityType=client&entityId=${id}&limit=20&skip=${historySkip}`);

      let newClientHistory: IHistory[] = [];
      if (clientHistoryResponse && typeof clientHistoryResponse === "object" && "data" in clientHistoryResponse) {
        newClientHistory = Array.isArray(clientHistoryResponse.data) ? clientHistoryResponse.data : [];
      }

      // Fetch more license history
      let newLicenseHistory: IHistory[] = [];
      if (licenses.length > 0) {
        const licenseIds = licenses
          .map((l) => idToString(l._id))
          .filter(Boolean);
        const licenseHistoryPromises = licenseIds.map((licenseId) =>
          api.get<{
            data: IHistory[];
            pagination: { skip: number; limit: number; total: number; hasMore: boolean };
          }>(`/api/history/read?entityType=license&entityId=${licenseId}&limit=20&skip=${historySkip}`)
        );
        const licenseHistoryResults = await Promise.all(licenseHistoryPromises);
        newLicenseHistory = licenseHistoryResults.flatMap((result) => {
          if (result && typeof result === "object" && "data" in result) {
            return Array.isArray(result.data) ? result.data : [];
          }
          return Array.isArray(result) ? result : [];
        });
      }

      // Combine and sort
      const newHistory = [...newClientHistory, ...newLicenseHistory].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setHistory((prev) => {
        const combined = [...prev, ...newHistory];
        // Remove duplicates based on _id
        const unique = combined.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t._id === item._id)
        );
        return unique.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      // Update pagination state (use client history as reference)
      if (clientHistoryResponse && typeof clientHistoryResponse === "object" && "data" in clientHistoryResponse) {
        setHistorySkip(clientHistoryResponse.pagination.skip + clientHistoryResponse.pagination.limit);
        setHistoryHasMore(clientHistoryResponse.pagination.hasMore);
      }
    } catch (err) {
      console.error("Error loading more history:", err);
    } finally {
      setLoadingMoreHistory(false);
    }
  }, [client, id, licenses, loadingMoreHistory, historyHasMore, historySkip]);

  // Intersection Observer for Validation History
  useEffect(() => {
    if (!validationHistoryHasMore || loadingMoreValidationHistory) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && validationHistoryHasMore && !loadingMoreValidationHistory) {
          loadMoreValidationHistory();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = validationHistoryObserverRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [validationHistoryHasMore, loadingMoreValidationHistory, loadMoreValidationHistory]);

  // Intersection Observer for Activity History
  useEffect(() => {
    if (!historyHasMore || loadingMoreHistory) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && historyHasMore && !loadingMoreHistory) {
          loadMoreHistory();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = historyObserverRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [historyHasMore, loadingMoreHistory, loadMoreHistory]);

  // Intersection Observer for Revoked Licenses
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && revokedLicensesDisplayCount < revokedLicenses.length) {
          setRevokedLicensesDisplayCount((prev) => Math.min(prev + 5, revokedLicenses.length));
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = revokedLicensesObserverRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [revokedLicenses.length, revokedLicensesDisplayCount]);

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
          <p className="text-gray-600 dark:text-gray-400 text-center">
            Client not found
          </p>
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
            {updating
              ? "Updating..."
              : (client.status || "active") === "active"
              ? "Deactivate"
              : "Activate"}
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
                    {primaryLicense.status !== "revoked" ? (
                      <div className="flex items-center gap-2">
                        {primaryLicense.status === "active" && (
                          <button
                            onClick={() =>
                              initiateLicenseStatusChange("deactivate")
                            }
                            disabled={updatingLicense}
                            className="px-3 py-1 text-xs rounded-lg font-medium bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Deactivate
                          </button>
                        )}
                        {primaryLicense.status === "inactive" && (
                          <button
                            onClick={() =>
                              initiateLicenseStatusChange("activate")
                            }
                            disabled={updatingLicense}
                            className="px-3 py-1 text-xs rounded-lg font-medium bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={initiateLicenseRevoke}
                          disabled={revokingLicense}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg font-medium bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ShieldOff className="w-3 h-3" />
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Revoked on{" "}
                        {formatDate(primaryLicense.revoked?.revokedAt?.toString())}
                      </span>
                    )}
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
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Status
                    </div>
                    <StatusBadge status={primaryLicense.status} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Version
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {primaryLicense.installedVersion || "N/A"}
                    </p>
                  </div>
                  {primaryLicense.machineCode && (
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Machine Code
                      </div>
                      <p className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
                        {primaryLicense.machineCode}
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Created
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(primaryLicense.createdAt?.toString())}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Updated
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(primaryLicense.updatedAt?.toString())}
                    </p>
                  </div>
                  {primaryLicense.lastValidatedAt && (
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Last Validated
                      </div>
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(primaryLicense.lastValidatedAt?.toString())}
                      </p>
                    </div>
                  )}
                </div>
                {primaryLicense.status === "revoked" && primaryLicense.revoked && (
                  <div className="mt-4 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">
                      Revocation Details
                    </p>
                    <div className="text-xs text-gray-700 dark:text-gray-200 space-y-1">
                      <p>
                        <span className="font-medium">Revoked On:</span>{" "}
                        {formatDate(primaryLicense.revoked.revokedAt?.toString())}
                      </p>
                      {primaryLicense.revoked.reason && (
                        <p>
                          <span className="font-medium">Reason:</span>{" "}
                          {primaryLicense.revoked.reason}
                        </p>
                      )}
                      {primaryLicense.revoked.revokedBy && (
                        <p>
                          <span className="font-medium">By:</span>{" "}
                          {primaryLicense.revoked.revokedBy.toString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                <Key className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  No License
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This client does not have a license yet
                </p>
              </div>
            )}

            {revokedLicenses.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldOff className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Revoked Licenses ({revokedLicenses.length})
                  </p>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {displayedRevokedLicenses.map((license) => (
                    <div
                      key={license._id?.toString() || license.licenseKey}
                      className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50 dark:bg-red-900/10"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            License Key
                          </p>
                          <p className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
                            {license.licenseKey}
                          </p>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Revoked:{" "}
                          {formatDate(license.revoked?.revokedAt?.toString())}
                        </div>
                      </div>
                      {license.revoked?.reason && (
                        <p className="text-xs text-gray-700 dark:text-gray-200 mt-2">
                          <span className="font-semibold">Reason:</span>{" "}
                          {license.revoked.reason}
                        </p>
                      )}
                      {license.revoked?.revokedBy && (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-semibold">By:</span>{" "}
                          {license.revoked.revokedBy.toString()}
                        </p>
                      )}
                    </div>
                  ))}
                  {revokedLicensesDisplayCount < revokedLicenses.length && (
                    <div
                      ref={revokedLicensesObserverRef}
                      className="flex justify-center py-2"
                    >
                      <LoadingSpinner size="sm" />
                    </div>
                  )}
                </div>
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
                          <span
                            className={`font-medium ${
                              entry.valid
                                ? "text-green-800 dark:text-green-300"
                                : "text-red-800 dark:text-red-300"
                            }`}
                          >
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
                          <span className="font-mono break-all">
                            {entry.licenseKey}
                          </span>
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
                  {validationHistoryHasMore && (
                    <div
                      ref={validationHistoryObserverRef}
                      className="flex justify-center py-2"
                    >
                      {loadingMoreValidationHistory ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Loading more...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                  <CheckCircle className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No validation history
                  </p>
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
                        <span className="font-medium">{entry.oldValue}</span> →{" "}
                        <span className="font-medium">{entry.newValue}</span>
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
                            by{" "}
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                              {entry.createdBy}
                            </span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(entry.createdAt?.toString())}
                      </span>
                    </div>
                  </div>
                ))}
                {historyHasMore && (
                  <div
                    ref={historyObserverRef}
                    className="flex justify-center py-2"
                  >
                    {loadingMoreHistory ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Loading more...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No history available
                </p>
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
            ? `Are you sure you want to deactivate ${
                client.name || client.email
              }? You can add a note to explain the reason.`
            : `Are you sure you want to activate ${
                client.name || client.email
              }? You can add a note to explain the reason.`
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
            : "Deactivate License"
        }
        message={
          licenseActionType === "activate"
            ? `Are you sure you want to activate this license? You can add a note to explain the reason.`
            : `Are you sure you want to deactivate this license? You can add a note to explain the reason.`
        }
        placeholder="Add a note or remark about this license status change (optional)..."
        confirmText="Confirm"
        cancelText="Cancel"
      />

      <NoteDialog
        isOpen={showRevokeDialog}
        onClose={() => setShowRevokeDialog(false)}
        onConfirm={handleRevokeNoteConfirm}
        title="Revoke License"
        message="Revoking a license will prevent it from being used going forward. You can optionally add a reason for tracking."
        placeholder="Add a note or reason for revoking this license (optional)..."
        confirmText="Revoke"
        cancelText="Cancel"
      />
    </div>
  );
}
