import type { Metadata } from "next";
import Link from "next/link";
import { CallBackForm } from "@/components/CallBackForm";

export const metadata: Metadata = {
  title: "About us",
  description: "A UK motoring company run by real people. We check every partner and show you the price before you book.",
};

export default function AboutPage() {
  return (
    <>
      <section className="hero">
        <div className="in">
          <h1>Who we are</h1>
          <p>
            A UK motoring company run by real people. We check every partner, show you the price before you book, and
            pick up the phone when you need us.
          </p>
        </div>
      </section>

      <main className="page overlap">
        <div className="card highlight">
          <b>To complete before launch:</b> everything in [square brackets] and the contact details. UK law requires
          your company name, number and registered office on the website. Only publish facts that are true.
        </div>

        <div className="card accent-left">
          <h2>Our story</h2>
          <p>
            The Motoring Central is an independent UK company. We started it because finding a mechanic, garage or
            recovery company you can trust should not be guesswork, and because good local businesses deserve a fair way
            to find customers without giving away a big slice of every job.
          </p>
          <p>
            So we built one place where drivers can see the price first, choose who they want and get help from real
            people, and where partners set their own prices and keep more of what they earn.
          </p>
          <p style={{ fontWeight: 700 }}>The Motoring Central team</p>
        </div>

        <h2 className="sec">Real people, not robots</h2>
        <div className="grid">
          <div className="card">
            <b>A real UK team</b>
            <p>Our support team is based in the UK. When you call, message or email, a person reads it and replies.</p>
          </div>
          <div className="card">
            <b>Talk to us your way</b>
            <p>
              Phone: <b>[0113 000 0000]</b>
              <br />
              WhatsApp: <b>[07000 000000]</b>
              <br />
              Email: <b>[hello@motoringcentral.co.uk]</b>
              <br />
              [Mon to Fri 8am to 6pm, Sat 9am to 1pm]
            </p>
          </div>
          <div className="card">
            <b>Real partners</b>
            <p>
              Every mechanic, garage, recovery company, tyre fitter and valeter is a real local business. We check their
              photo ID and insurance before they can take a booking.
            </p>
          </div>
        </div>

        <div className="card" id="call-back" style={{ marginTop: 14, border: "2px solid var(--sky)" }}>
          <h2>Prefer a call back?</h2>
          <p className="muted small">Leave your number and someone from our team will call you.</p>
          <CallBackForm />
        </div>

        <h2 className="sec">Why choose us</h2>
        <div className="grid">
          {[
            ["Checked partners", "Photo ID, trade insurance and public liability insurance checked before anyone can take a job, and again when documents expire."],
            ["Fixed price first", "See the full price, including parts and labour, before you book. No surprises at the door."],
            ["Choice, not a lottery", "Compare partners by price, rating and distance, and choose who you want."],
            ["Pay securely", "Pay by card through our secure checkout. We pay the partner on your behalf."],
            ["Warranty on the work", "Your partner's warranty terms are shown before you book, and we help you contact them if anything goes wrong."],
            ["Everything in one place", "Servicing, repairs, MOT, auto electrics, tyres, valeting, recovery and buying a car or van."],
          ].map(([title, text]) => (
            <div className="card" key={title}>
              <b>{title}</b>
              <p>{text}</p>
            </div>
          ))}
        </div>

        <h2 className="sec">Book with confidence</h2>
        <div className="card">
          <ol className="terms-list">
            <li>
              <b>Before you book</b> you see who will do the job, their price, their rating and their warranty terms.
            </li>
            <li>
              <b>Extra work needs your OK.</b> Partners must explain any extra work and agree a price with you before
              doing it.
            </li>
            <li>
              <b>If something goes wrong</b>, contact the partner first. If it is not sorted, call or message us and we
              will step in to help both sides reach a fair outcome.
            </li>
            <li>
              <b>Honest reviews only.</b> Reviews come from real, completed bookings.
            </li>
            <li>
              <b>Your rights stay in place.</b> Nothing we do affects your rights under UK consumer law.
            </li>
          </ol>
          <p className="small muted" style={{ marginTop: 8 }}>
            Read the full <Link href="/terms">terms and conditions</Link>.
          </p>
        </div>

        <h2 className="sec">Company details</h2>
        <div className="card">
          <p style={{ margin: 0 }}>
            <b>The Motoring Central Ltd</b>
            <br />
            Registered in England and Wales, company number [00000000]
            <br />
            Registered office: [address]
            <br />
            ICO data protection registration: [ZA000000]
            <br />
            VAT number: [if registered]
          </p>
        </div>
      </main>
    </>
  );
}
