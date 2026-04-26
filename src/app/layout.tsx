import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scoutent",
  description:
    "Continuous patent scouting for drug opportunities. Surface generic-eligible molecules and unfiled-region windows before competitors do.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
