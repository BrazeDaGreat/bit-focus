import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next"
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PomoProvider } from "@/hooks/PomoContext";
import TopBar from "@/components/TopBar";

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
    url: "https://bitfocus.vercel.app/",
    type: "website",
    images: [],
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
        <PomoProvider>
          <SidebarProvider>
            <ThemeProvider
              attribute="class"
              value={{
                light: "light",
                dark: "dark",
                amethyst: "amethyst",
                bluenight: "bluenight",
                amoled: "amoled",
              }}
              defaultTheme="system"
              enableSystem={true}
            >
              <AppSidebar />
              {/* <SidebarTrigger /> */}
              <div className="flex-1 flex flex-col max-h-screen overflow-y-auto">
                <TopBar />
                {children}
              </div>
            </ThemeProvider>
          </SidebarProvider>
        </PomoProvider>
        <Analytics />
      </body>
    </html>
  );
}
