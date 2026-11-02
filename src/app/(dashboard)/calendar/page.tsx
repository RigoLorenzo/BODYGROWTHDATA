import { redirect } from "next/navigation";

/** Il calendario è diventato lo Storico: i vecchi link continuano a funzionare */
export default function CalendarPage() {
  redirect("/history");
}
