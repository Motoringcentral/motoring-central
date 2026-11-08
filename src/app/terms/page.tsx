import type { Metadata } from "next";
import { termsSections, termsSummary } from "@/lib/terms";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description:
    "Who is responsible for what when you book work, buy a vehicle or join The Motoring Central as a partner or dealer.",
};

export default function TermsPage() {
  return (
    <>
      <section className="hero">
        <div className="in">
          <h1>Terms and conditions</h1>
          <p>
            Who is responsible for what when you book work, buy a vehicle or join The Motoring Central as a partner or
            dealer.
          </p>
        </div>
      </section>

      <main className="page overlap">
        <div className="card highlight">
          <b>Draft for review.</b> These terms are a working draft. Have them checked by a solicitor before launch.
          Bracketed items such as [company number] still need filling in.
        </div>

        <div className="card">
          <h2>The short version</h2>
          <ul className="terms-list">
            {termsSummary.map((s) => (
              <li key={s.text}>
                {s.lead && <b>{s.lead}</b>} {s.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="small muted" style={{ margin: "18px 0 8px" }}>
          Tap a section to read it in full.
        </p>

        {termsSections.map((section) => (
          <details className="terms" id={section.id} key={section.id}>
            <summary>{section.title}</summary>
            <div className="body">
              {section.intro?.map((p) => <p key={p}>{p}</p>)}
              {section.parts?.map((part) => (
                <div key={part.heading}>
                  <h3>{part.heading}</h3>
                  <p>{part.text}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </main>
    </>
  );
}
