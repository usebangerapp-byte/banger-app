import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import PlanGate from "@/components/PlanGate";
import RouteAudioStop from "@/components/RouteAudioStop";
import NativeBridge from "@/components/NativeBridge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://usebanger.com"),
  title: "BANGER",
  openGraph: { title: "BANGER", description: "Identify any track. Even unreleased.", images: ["/api/og"], siteName: "BANGER", type: "website" },
  twitter: { card: "summary_large_image", images: ["/api/og"] },
  description: "Scan music. Discover unreleased tracks. Follow what DJs are playing.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "BANGER", statusBarStyle: "black-translucent" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{ backgroundColor: "transparent" }}
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PlanGate />
        <RouteAudioStop />
        <NativeBridge />
        <TopBar />
        {children}
        <BottomNav />
  </body>
    </html>
  );
}