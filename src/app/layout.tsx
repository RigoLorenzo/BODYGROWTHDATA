import type { Metadata, Viewport } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { PwaRegister } from "@/components/pwa-register";
import { Analytics } from "@vercel/analytics/next";
import { ThemeSync } from "@/components/theme-sync";
import { themeBootScript } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

// Titoli e numeri: condensato sportivo, leggibile anche a colpo d'occhio in palestra
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BodyGrowth — Elite Fitness Tracker",
    template: "%s | BodyGrowth",
  },
  description: "Tracker di allenamento con progressive overload, analytics e PR tracking.",
  keywords: ["fitness", "workout tracker", "strength training", "powerlifting", "progressive overload"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BodyGrowth",
    startupImage: "/apple-touch-icon.png",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning className={`${inter.variable} ${display.variable}`}>
      <head>
        {/* Tema applicato prima del primo disegno: niente lampo chiaro/scuro */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <Toaster />
          <PwaRegister />
          <ThemeSync />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
