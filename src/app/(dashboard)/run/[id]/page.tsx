import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RunDetail } from "@/components/run/run-detail";

export const metadata = { title: "Corsa" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="container mx-auto max-w-xl space-y-3 px-4 pb-6 pt-3">
      <Link
        href="/run"
        className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full pl-1 pr-3 text-sm text-muted-foreground active:bg-muted"
      >
        <ChevronLeft className="h-5 w-5" /> Corsa
      </Link>
      <RunDetail id={id} />
    </div>
  );
}
