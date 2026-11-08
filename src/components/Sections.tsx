import Link from "next/link";
import { Icon } from "./Icons";
import { howItWorks, popularRepairs, services, whyChooseUs } from "@/lib/content";

export function TrustStrip() {
  return (
    <div className="trust-strip">
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        Every partner ID and insurance checked
      </span>
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        Fixed price before you book
      </span>
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        Real UK team. <Link href="/about">Talk to a person</Link>
      </span>
    </div>
  );
}

export function ServiceList() {
  return (
    <div className="ways">
      {services.map((s) => (
        <div className="card way" key={s.name}>
          <Icon name={s.icon} />
          <div>
            <b>{s.name}</b>
            <small>{s.short}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PopularRepairs() {
  return (
    <div className="tiles">
      {popularRepairs.map((r) => (
        <div className="card" key={r.name}>
          <Icon name={r.icon} />
          {r.name}
        </div>
      ))}
    </div>
  );
}

export function HowItWorks() {
  return (
    <div className="how">
      {howItWorks.map((step, i) => (
        <div className="card" key={step.title}>
          <div className="num">{i + 1}</div>
          <b>{step.title}</b>
          <br />
          <small>{step.text}</small>
        </div>
      ))}
    </div>
  );
}

export function WhyChooseUs() {
  return (
    <section className="why" aria-labelledby="why-h">
      <span className="badge">Why choose us</span>
      <h2 id="why-h">
        Car care you can <span>actually trust.</span>
      </h2>
      <p className="lead">
        One place for everything your car or van needs, done by checked local experts at a price you see before you
        book.
      </p>
      <div className="why-grid">
        {whyChooseUs.map((w) => (
          <div className="why-item" key={w.title}>
            <span className="why-icon" aria-hidden="true">
              <Icon name={w.icon} className="" />
            </span>
            <div>
              <b>{w.title}</b>
              <p>{w.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="why-cta">
        <Link className="btn yellow" href="/about">
          Meet the team behind it
        </Link>
        <span>
          Questions? <Link href="/about#call-back">Request a call back</Link>
        </span>
      </div>
    </section>
  );
}
