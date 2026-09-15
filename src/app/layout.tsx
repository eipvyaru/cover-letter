import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Сопроводительное письмо — AI-помощник",
  description: "Персональное письмо на основе вакансии и подтверждённого опыта.",
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
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}

