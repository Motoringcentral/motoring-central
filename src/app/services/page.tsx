import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { HowItWorks, PopularRepairs, TrustStrip } from "@/components/Sections";
import { services } from "@/lib/content";

export const metadata: Metadata = {
  title: "Our services",
  description:
    "Mobile mechanics, garages, MOT, recovery, mobile tyres, auto electricians, valeting, breakdown cover and cars for sale.",
};

export default function ServicesPage() {
  return (
    <>
      <section className="hero">
        <div className="in">
          <h1>Our services</h1>
          <p>
            Everything your car or van needs, from checked local partners. You see a fixed price and choose who does the
            job before you book.
          </p>
        </div>
      </section>

      <main className="page overlap">
        <div className="grid">
          {services.map((s) => (
            <div className="card" key={s.name}>
              <Icon name={s.icon} />
              <h2 style={{ margin: "8px 0 4px" }}>{s.name}</h2>
              <p>{s.short}</p>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--muted)", fontSize: ".9rem" }}>
                {s.detail.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <TrustStrip />

        <h2 className="sec">Popular repairs</h2>
        <PopularRepairs />

        <h2 className="sec">How it works</h2>
        <HowItWorks />

        <div className="card accent-left" style={{ marginTop: 24 }}>
          <h2>Ready to get a price?</h2>
          <p className="muted">Enter your reg on the homepage and we&rsquo;ll find your exact car.</p>
          <Link className="btn" href="/#reg" style={{ marginTop: 12 }}>
            Enter my reg
          </Link>
        </div>
        <p className="small muted">
          Every option shows a fixed price before you book. A booking fee applies. Your booking is with the partner you
          choose. See our <Link href="/terms">terms and conditions</Link>.
        </p>
      </main>
    </>
  );
}
