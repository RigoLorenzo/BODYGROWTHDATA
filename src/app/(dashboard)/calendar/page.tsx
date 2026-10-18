import { redirect } from "next/navigation";

/** Il calendario ora vive in Analytics: i vecchi link continuano a funzionare */
export default function CalendarPage() {
  redirect("/analytics?tab=calendario");
}
