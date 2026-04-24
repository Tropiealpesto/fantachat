import "./globals.css";
import { AppProvider } from "./components/AppContext";
import AppLayout from "./components/AppLayout";

export const metadata = {
  title: "FantaChat",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <AppProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </AppProvider>
      </body>
    </html>
  );
}