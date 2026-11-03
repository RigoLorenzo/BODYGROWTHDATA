"use client";

import { use } from "react";
import { ProgramView } from "@/components/programs/program-view";

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProgramView id={id} />;
}
