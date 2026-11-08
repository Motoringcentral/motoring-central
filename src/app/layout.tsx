import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "The Motoring Central: everything your car needs, in one place",
    template: "%s | The Motoring Central",
  },
  description:
    "Servicing, repairs, MOT, tyres, valeting and recovery from checked local partners. See a fixed price before you book.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={outfit.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <div className="launch-banner">
          Launch offer: 50% off our booking fee. Just &pound;2.50 per booking, usually &pound;4.99.
        </div>
        <div id="main">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
