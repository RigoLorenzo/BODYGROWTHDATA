import { redirect } from "next/navigation";
import { FITNESS_PATH } from "@/lib/routes";
import { toQuery } from "@/lib/redirect-query";

/** Analytics ora si chiama Fitness: scheda, periodo e data scelti restano gli stessi */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(`${FITNESS_PATH}${toQuery(await searchParams)}`);
}
