import type { Metadata } from "next";
import { Ubuntu_Mono } from "next/font/google";
import "./globals.css";

const ubuntuMono = Ubuntu_Mono({
  variable: "--font-ubuntu-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Scamp — Sketch layouts. Ship real code.",
  description:
    "A local-first design tool for developers. Draw layouts visually, get real TSX and CSS Modules files. Free and open source.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={ubuntuMono.variable}>
      <body>{children}</body>
    </html>
  );
}
