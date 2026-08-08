import { redirect } from "next/navigation";

/** Legacy URL — contact is the canonical bug/report page. */
export default function FeedbackRedirectPage() {
  redirect("/contact");
}
