import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BIT Focus",
  description: "Plz focus... for a bit. ha ha ha.",
  openGraph: {
    title: "BIT Focus",
    description: "Plz focus... for a bit. ha ha ha.",
    // url: "https://example.com",
    type: "website",
    images: [
      // {
      //   url: "https://example.com/image.jpg",
      //   width: 800,
      //   height: 600,
      //   alt: "Og Image Alt",
      // },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SidebarProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AppSidebar />
            <SidebarTrigger />
            {children}
          </ThemeProvider>
        </SidebarProvider>
      </body>
    </html>
  );
}
