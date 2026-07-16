import type { Metadata, Viewport } from "next";
import { Archivo, Geist, IBM_Plex_Mono } from "next/font/google";

import { AppShell } from "@/components/shell/app-shell";
import { Sidebar } from "@/components/shell/sidebar";

import { Theme } from "@radix-ui/themes";

import "@radix-ui/themes/styles.css";
import "./globals.css";

// Display and data carry the personality. Archivo is signage type, which is
// what an industrial plant is actually lettered in. IBM Plex Mono reads like an
// instrument readout, which is what the numbers on this page are. The body face
// stays quiet on purpose.
const archivo = Archivo({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistSans = Geist({
  variable: "--font-body-face",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Scrap",
  description:
    "An AI system that automatically classifies waste on the conveyor belt in material recovery facilities.",
  icons: { icon: "/scrap_logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#f1f3ef",
  colorScheme: "light",
};

/**
 * The shell lives on the root layout because the application is open access.
 * There is no sign in, no account and no session, so every page is reachable
 * straight away and there is nothing to guard.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${geistSans.variable} ${plexMono.variable} antialiased`}
      >
        {/* The real Radix theme, so Button variant="classic" is the genuine
            Radix control rather than something shaped like it. */}
        <Theme
          appearance="light"
          accentColor="grass"
          grayColor="sage"
          radius="medium"
          scaling="100%"
          panelBackground="solid"
        >
          <AppShell sidebar={<Sidebar />}>{children}</AppShell>
        </Theme>
      </body>
    </html>
  );
}
