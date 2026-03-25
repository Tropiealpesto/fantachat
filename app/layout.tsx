import "./globals.css";
import { AppProvider } from "./components/AppContext";

export const metadata = {
  title: "FantaChat",
  manifest: "/manifest.json",
};

<link rel="apple-touch-icon" href="/icon-512.png" />

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
