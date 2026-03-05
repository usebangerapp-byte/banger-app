import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
title: "Banger",
description: "Banger DJ Recognition",

icons: {
icon: "/icon-192.png",
apple: "/apple-touch-icon.png",
},

manifest: "/manifest.webmanifest",

themeColor: "#000000",

appleWebApp: {
capable: true,
statusBarStyle: "black-translucent",
title: "Banger",
},
};

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
</body>
</html>
);
}
