import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Layout/Sidebar";

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
        <div style={{ display: 'flex' }}>
          <Sidebar />
          <main style={{
            marginLeft: 'var(--sidebar-width)',
            width: 'calc(100% - var(--sidebar-width))',
            minHeight: '100vh',
            backgroundColor: 'var(--background)'
          }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
