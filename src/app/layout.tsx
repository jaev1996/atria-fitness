import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atria Fitness",
  description: "Sistema de Gestión para Estudio Fitness",
  icons: {
    icon: [
      { url: '/icon.png?v=2', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png?v=2', type: 'image/png' },
    ],
  },
};

import { CookieConsent } from "@/components/shared/cookie-consent";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <CookieConsent />
        <Toaster />
      </body>
    </html>
  );
}
