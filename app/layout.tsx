import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calidad 360 | Plátano verde",
  description: "Sistema digital de análisis de calidad y mejora continua.",
  other: { "codex-preview": "development" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
