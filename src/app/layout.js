import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/Layout/AppLayout";
import ConnectionStatus from "@/components/Layout/ConnectionStatus";
import ServiceWorkerRegistrar from "@/components/Layout/ServiceWorkerRegistrar";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Flames by the Indus | POS",
  description: "Point of Sale System for Flames by the Indus",
  manifest: "/manifest.webmanifest",
};

// Matches the app background so an installed till has no light flash on launch
export const viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = await getRole(supabase, user?.id);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppLayout role={role}>
          {children}
        </AppLayout>
        {/* Global, so a dropped connection is visible on every screen — the KDS
            especially, where a stale board reads as a quiet service. */}
        <ConnectionStatus />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
