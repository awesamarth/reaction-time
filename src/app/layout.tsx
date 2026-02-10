import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P, Rajdhani } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  weight: '400',
  variable: '--font-doom',
  subsets: ['latin'],
});

const rajdhani = Rajdhani({
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-rajdhani',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: "Reaction Time | RISE Cookbook",
  description: "Test your reflexes with 3ms receipts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pressStart2P.variable} ${rajdhani.variable} antialiased`}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}
