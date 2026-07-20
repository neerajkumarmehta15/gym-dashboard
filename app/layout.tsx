import type { Metadata } from "next";
import { Outfit, Space_Grotesk } from "next/font/google";
import "./globals.css";
import RefreshRedirect from "./RefreshRedirect";
import PWAInstallPrompt from "../components/PWAInstallPrompt";
import GlobalGalaxyBackground from "../components/GlobalGalaxyBackground";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GymNation | CRM & Athlete Portal",
  description: "Advanced Gym Management & Athlete Progress Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymNation",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100 relative">
        <GlobalGalaxyBackground />
        <RefreshRedirect />
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
