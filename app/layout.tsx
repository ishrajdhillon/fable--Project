import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fable — Your AI workspace",
  description: "Think, write, code, and explore with Fable AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
