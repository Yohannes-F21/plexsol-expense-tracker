import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import "../styles/globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Plexsol Expense Tracker",
  description: "Multi-tenant SaaS expense tracking platform",
  icons: {
    icon: [
      {
        url: "/Plexsol Icon-dark 2.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/Plexsol Icon-dark 2.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "//Plexsol Icon-dark 2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
