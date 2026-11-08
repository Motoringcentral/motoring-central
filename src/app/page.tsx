import Link from "next/link";
import { RegLookup } from "@/components/RegLookup";
import { HowItWorks, PopularRepairs, ServiceList, TrustStrip, WhyChooseUs } from "@/components/Sections";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="in">
          <h1>Everything your car needs. One place.</h1>
          <p>
            Buy a car, repair it, MOT, tyres, valeting and recovery. Enter your reg to get a fixed price from a partner
            you choose.
          </p>
          <HeroArt />
        </div>
      </section>

      <main className="page overlap">
        <RegLookup />
        <TrustStrip />

        <h2 className="sec">Everything we offer</h2>
        <ServiceList />
        <p className="small muted" style={{ marginTop: 10 }}>
          Every option shows a fixed price before you book. A booking fee applies.
        </p>
        <Link className="btn block" href="/services">
          See all our services
        </Link>

        <h2 className="sec">Popular repairs</h2>
        <PopularRepairs />

        <h2 className="sec">How it works</h2>
        <HowItWorks />

        <div className="stats">
          <div>
            <b>Fixed</b>price before you book
          </div>
          <div>
            <b>Checked</b>ID and insurance
          </div>
          <div>
            <b>UK team</b>real people to help
          </div>
          <div>
            <b>&pound;0</b>call-out fee
          </div>
        </div>

        <WhyChooseUs />

        <div className="card promo">
          <LiftArt />
          <div>
            <h2 style={{ margin: 0 }}>Vetted, insured mechanics</h2>
            <ul>
              <li>ID and qualification checks</li>
              <li>Public liability insurance</li>
              <li>12-month parts and labour warranty, given by the mechanic</li>
            </ul>
          </div>
        </div>

        <h2 className="sec">What drivers say</h2>
        <div className="grid">
          <Review stars={5} text="Brake pads done on my driveway while I worked from home. Price matched the quote exactly." who="Sarah, Leeds" />
          <Review stars={5} text="Typed my reg, saw the exact parts, booked in two minutes. Dan was brilliant." who="James, Bristol" />
          <Review stars={4} text="Battery swapped at my office in under an hour. Would use again." who="Priya, Manchester" />
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Sample reviews. Real reviews from completed bookings will replace these.
        </p>
      </main>
    </>
  );
}

function Review({ stars, text, who }: { stars: number; text: string; who: string }) {
  return (
    <div className="card review">
      <span className="stars" aria-label={`${stars} out of 5 stars`}>
        {"★".repeat(stars)}
        {"☆".repeat(5 - stars)}
      </span>
      <p>{text}</p>
      <small>{who}</small>
    </div>
  );
}

function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 360 150" role="img" aria-label="A mechanic with a wrench beside a yellow car outside a house">
      <circle cx="318" cy="26" r="12" fill="#ffcf3f" opacity=".9" />
      <ellipse cx="250" cy="30" rx="22" ry="7" fill="#fff" opacity=".18" />
      <ellipse cx="60" cy="22" rx="26" ry="7" fill="#fff" opacity=".14" />
      <path d="M288 128V92l34-28 34 28v36z" fill="#1d9a84" />
      <path d="M282 94l40-33 40 33" fill="none" stroke="#08362f" strokeWidth="5" strokeLinejoin="round" />
      <rect x="314" y="104" width="16" height="24" fill="#08362f" />
      <rect x="296" y="98" width="12" height="12" fill="#bfe3f0" />
      <rect y="128" width="360" height="22" fill="#08362f" />
      <rect y="128" width="360" height="3" fill="#0e5a4c" />
      <path d="M30 118c0-9 4-15 13-17l20-20c4-4 9-6 15-6h36c7 0 12 3 16 8l13 15c12 1 17 6 17 15v5z" fill="#ffcf3f" />
      <path d="M72 99l14-15c2-2 5-3 8-3h24c3 0 6 2 8 4l9 14z" fill="#bfe3f0" />
      <rect x="28" y="108" width="7" height="5" rx="2" fill="#fff" />
      <circle cx="68" cy="116" r="13" fill="#111" />
      <circle cx="68" cy="116" r="5" fill="#cfd8dc" />
      <circle cx="158" cy="116" r="13" fill="#111" />
      <circle cx="158" cy="116" r="5" fill="#cfd8dc" />
      <rect x="207" y="108" width="8" height="20" fill="#2b3a47" />
      <rect x="219" y="108" width="8" height="20" fill="#2b3a47" />
      <rect x="205" y="80" width="24" height="30" rx="4" fill="#ff7a1a" />
      <rect x="205" y="93" width="24" height="4" fill="#ffe082" />
      <circle cx="217" cy="70" r="9" fill="#f1c27d" />
      <path d="M207 68c0-8 5-11 10-11s10 3 10 11z" fill="#fff" />
      <path d="M229 86l18 8" stroke="#ff7a1a" strokeWidth="6" strokeLinecap="round" />
      <path d="M247 94l14-12" stroke="#cfd8dc" strokeWidth="4" strokeLinecap="round" />
      <circle cx="262" cy="81" r="5" fill="none" stroke="#cfd8dc" strokeWidth="3" />
      <rect x="250" y="116" width="26" height="12" rx="2" fill="#d93025" />
      <path d="M257 116v-4h12v4" fill="none" stroke="#8c1c14" strokeWidth="2" />
    </svg>
  );
}

function LiftArt() {
  return (
    <svg viewBox="0 0 200 110" role="img" aria-label="A car raised on a workshop lift">
      <rect x="0" y="96" width="200" height="14" fill="var(--line)" />
      <rect x="34" y="30" width="8" height="66" fill="var(--muted)" />
      <rect x="158" y="30" width="8" height="66" fill="var(--muted)" />
      <rect x="28" y="34" width="144" height="6" rx="3" fill="var(--ink)" />
      <path d="M46 32c0-7 3-11 9-12l14-14c3-3 6-4 10-4h26c5 0 8 2 11 5l9 11c8 1 12 4 12 10v4z" fill="var(--brand)" />
      <path d="M74 20l10-11c2-2 3-2 6-2h18c2 0 4 1 5 3l7 10z" fill="var(--bg)" />
      <circle cx="68" cy="34" r="8" fill="var(--ink)" />
      <circle cx="134" cy="34" r="8" fill="var(--ink)" />
      <rect x="92" y="64" width="22" height="32" rx="4" fill="#ff7a1a" />
      <circle cx="103" cy="56" r="8" fill="#f1c27d" />
      <path d="M95 54c0-7 4-9 8-9s8 2 8 9z" fill="#ffcf3f" />
    </svg>
  );
}
