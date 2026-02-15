import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "murebbiye",
  description: "Phase 1 bootstrap for the murebbiye bilingual TR+EN tutoring pilot."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
