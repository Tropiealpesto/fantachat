import "./globals.css";
import { AppProvider } from "./components/AppContext";
import SideDrawerWrapper from "./components/SideDrawerWrapper";

export const metadata = {
  title: "FantaChat",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <AppProvider>
          <SideDrawerWrapper />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}