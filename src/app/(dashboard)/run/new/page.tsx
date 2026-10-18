import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NewRunForm } from "@/components/run/new-run-form";

export const metadata = { title: "Nuova corsa" };

export default function NewRunPage() {
  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 pb-6 pt-3">
      <div className="flex items-center gap-2">
        <Link href="/run" aria-label="Indietro" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Nuova corsa</h1>
      </div>
      <NewRunForm />
    </div>
  );
}
