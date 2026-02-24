import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PlausibleProvider from "next-plausible";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { TanStackQueryProvider } from "@/components/providers/TanStackQueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { rootMetadata } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = rootMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <PlausibleProvider
          domain="aivshuman.thedaviddias.com"
          enabled={process.env.NODE_ENV === "production"}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-neutral-950 text-neutral-50 antialiased`}
      >
        <NuqsAdapter>
          <ConvexClientProvider>
            <TanStackQueryProvider>
              <ThemeProvider>
                <ScrollToTop />
                <Header />
                <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-160px)]">
                  {children}
                </main>
                <Footer />
              </ThemeProvider>
            </TanStackQueryProvider>
          </ConvexClientProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
