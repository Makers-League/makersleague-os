import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Makers League OS", template: "%s · Makers League OS" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
