import "./globals.css";
import { AppProvider } from "./components/AppContext";

export const metadata = {
  title: "FantaChat",
  description: "FantaChat",
};

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
