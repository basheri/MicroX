import type { Metadata } from "next";
import { RTL } from "@/lib/rtl";
import { SiteNav } from "@/ui/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MicroX — عمادة التعلم الإلكتروني، جامعة الملك عبدالعزيز",
  description: "منصة بناء البرامج الجامعية القصيرة (المايكروية / المعتمدات الصغيرة).",
};

// Root layout enforces the Arabic-only, strict-RTL shell for the whole app
// (rule 50-arabic-rtl-ui): lang="ar", dir="rtl".
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={RTL.lang} dir={RTL.dir}>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
