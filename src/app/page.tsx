import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware handles unauthenticated bounces to /login.
  // Authenticated users land on the dashboard.
  redirect("/dashboard");
}
