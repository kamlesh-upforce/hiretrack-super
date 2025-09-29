"use client";

import React from "react";
import { useParams } from "next/navigation";
import ClientEditForm from "./ClientEditForm";

export default function EditClientPage() {
  const params = useParams();
  const id = params?.id as string;

  return <ClientEditForm id={id} />;
}
