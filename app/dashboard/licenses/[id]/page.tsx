"use client";

import React from "react";
import { useParams } from "next/navigation";
import LicenseDetailClient from "./LicenseDetailClient";

// This is a wrapper component that gets the ID from the URL params
// and passes it to the client component
export default function LicenseDetailPage() {
  // Use the useParams hook to get the ID from the URL
  const params = useParams();
  const id = params?.id as string;

  return <LicenseDetailClient id={id} />;
}
