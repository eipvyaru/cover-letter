import type { Metadata } from "next";
import "./globals.css";
import "./footer.css";

export const metadata: Metadata = {
  title: "Сопроводительное письмо — AI-помощник",
  description: "Персональное письмо на основе вакансии и подтверждённого опыта.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

