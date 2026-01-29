import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/Layout/AppLayout";

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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
