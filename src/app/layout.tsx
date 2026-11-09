import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Footer } from "@/components/site/footer";
import { Header, LaunchBanner } from "@/components/site/header";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://motoringcentral.co.uk"),
  title: {
    default: "Motoring Central – everything your car needs, in one place",
    template: "%s | Motoring Central",
  },
  description:
    "Buy a car, repair it, MOT, tyres, bodywork, alloy wheels, valeting, recovery and EV charging. Enter your reg to get a fixed price from a checked local partner you choose.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#38BDF8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${outfit.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <LaunchBanner />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
