import type { Metadata } from "next";
import { Suspense } from "react";
import YandexMetrika from "@/client/components/yandex-metrika";
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
  const enableMetrika = process.env.NODE_ENV === "production";
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
        {enableMetrika && (
          <Suspense fallback={null}>
            <YandexMetrika />
          </Suspense>
        )}
        {enableMetrika && (
          <noscript>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://mc.yandex.ru/watch/112797266"
                style={{ position: "absolute", left: "-9999px" }}
                alt=""
              />
            </div>
          </noscript>
        )}
      </body>
    </html>
  );
}

