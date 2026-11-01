import { redirect } from "next/navigation";

/** Lo storico (ex calendario) vive in Analytics: i vecchi link continuano a funzionare */
export default function CalendarPage() {
  redirect("/analytics?tab=storico");
}
