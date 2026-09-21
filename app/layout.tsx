import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/context/AuthProvider";

export const metadata: Metadata = {
  title: {
    default: "Pakistani Noor - Your Trusted Online Store in Bangladesh",
    template: "%s | Pakistani Noor",
  },
  description:
    "Shop the best products at Pakistani Noor. Discover amazing deals on electronics, fashion, home goods, and more with fast delivery across Bangladesh.",
  keywords: [
    "online shopping",
    "bangladesh",
    "ecommerce",
    "pakistani noor",
    "best prices",
    "fast delivery",
  ],
  authors: [{ name: "Pakistani Noor" }],
  creator: "Pakistani Noor",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "Pakistani Noor",
    title: "Pakistani Noor - Your Trusted Online Store",
    description: "Shop the best products with fast delivery across Bangladesh",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pakistani Noor - Your Trusted Online Store",
    description: "Shop the best products with fast delivery across Bangladesh",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
