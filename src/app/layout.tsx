import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Footer } from "@/components/site/footer";
import { Header, LaunchBanner } from "@/components/site/header";
import { IS_PREVIEW } from "@/lib/site";
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
  robots: IS_PREVIEW ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#38BDF8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${outfit.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {IS_PREVIEW && (
          <div className="bg-navy px-3.5 py-2 text-center text-[.82rem] text-white">
            Preview while we build the site. Partners, prices and vehicles are sample data, and nothing is booked or
            charged.
          </div>
        )}
        <Header />
        <LaunchBanner />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
