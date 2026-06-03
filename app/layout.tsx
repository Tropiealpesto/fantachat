import "./globals.css";
import { AppProvider } from "./components/AppContext";
import SideDrawerWrapper from "./components/SideDrawerWrapper";

export const metadata = {
  title: "FantaChat",
  description: "Il primo fantacalcio costruito attorno alla conversazione della lega.",
  manifest: "/manifest.json",
  themeColor: "#16a34a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FantaChat",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        {/* PWA iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FantaChat" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* PWA Android */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#16a34a" />
      </head>
      <body>
        <AppProvider>
          <SideDrawerWrapper />
          {children}
        </AppProvider>

        {/* Registra Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
