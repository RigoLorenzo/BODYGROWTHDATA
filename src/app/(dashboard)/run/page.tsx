import { redirect } from "next/navigation";
import { FITNESS_PATH } from "@/lib/routes";
import { toQuery } from "@/lib/redirect-query";

/** La corsa ora è una scheda di Fitness: periodo e data scelti restano gli stessi */
export default async function RunPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(`${FITNESS_PATH}${toQuery(await searchParams, { tab: "corsa" })}`);
}
