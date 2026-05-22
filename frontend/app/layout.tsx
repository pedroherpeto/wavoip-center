import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Sidebar } from "@/components/Sidebar";
import { WaVoIPWebphone } from "@/components/WaVoIPWebphone";
import { SocketBridge } from "@/components/SocketBridge";
import { SendMessageDialog } from "@/components/SendMessageDialog";
import { AudioMixer } from "@/components/AudioMixer";
import { NotificationsBridge } from "@/components/NotificationsBridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wavoip Agent",
  description: "Wavoip PABX - agent panel",
  manifest: "/manifest.json",
  applicationName: "Wavoip Agent",
  icons: {
    icon: [
      { url: "/wavoip.png", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16" },
    ],
    apple: "/icons/apple-icon-180x180.png",
    shortcut: "/icons/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wavoip Agent",
  },
};

export const viewport: Viewport = {
  themeColor: "#25D366",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <div className="min-h-screen">
              <Sidebar />
              <main className="lg:ml-64 min-h-screen">
                <div className="mx-auto max-w-5xl p-4 lg:p-8">{children}</div>
              </main>
              <SocketBridge />
              <AudioMixer />
              <WaVoIPWebphone />
              <NotificationsBridge />
              <SendMessageDialog />
            </div>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
