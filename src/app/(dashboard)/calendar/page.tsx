import { redirect } from "next/navigation";

/** Il calendario ora è nella scheda Andamento di Analytics: i vecchi link continuano a funzionare */
export default function CalendarPage() {
  redirect("/analytics?tab=andamento");
}
