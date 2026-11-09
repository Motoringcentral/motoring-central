export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0B1C35,#16305C)] pb-11 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(56,189,248,.38),transparent_42%),radial-gradient(circle_at_8%_92%,rgba(255,255,255,.14),transparent_46%)]"
      />
      <div className="relative mx-auto max-w-page px-4 pt-6">
        <h1 className="mb-2 text-[1.9rem] leading-[1.08] font-extrabold sm:text-[2.1rem]">
          Everything your car needs. One place.
        </h1>
        <p className="mb-1.5 max-w-[34em] text-mist">
          Buy a car, repair it, MOT, tyres, bodywork, alloy wheels, valeting, recovery and EV charging. Enter your reg to get a
          fixed price from a partner you choose.
        </p>
        <HeroScene />
      </div>
    </section>
  );
}

function HeroScene() {
  return (
    <svg
      viewBox="0 0 360 150"
      role="img"
      aria-label="A mechanic with a wrench beside a yellow car outside a house"
      className="mt-2.5 block h-auto w-full"
    >
      <circle className="anim-pulse" cx="318" cy="26" r="12" fill="#ffcf3f" opacity=".9" />
      <ellipse className="anim-drift" cx="250" cy="30" rx="22" ry="7" fill="#fff" opacity=".18" />
      <ellipse className="anim-drift" cx="60" cy="22" rx="26" ry="7" fill="#fff" opacity=".14" />
      <path d="M288 128V92l34-28 34 28v36z" fill="#1d9a84" />
      <path d="M282 94l40-33 40 33" fill="none" stroke="#08362f" strokeWidth="5" strokeLinejoin="round" />
      <rect x="314" y="104" width="16" height="24" fill="#08362f" />
      <rect x="296" y="98" width="12" height="12" fill="#bfe3f0" />
      <rect y="128" width="360" height="22" fill="#08362f" />
      <rect y="128" width="360" height="3" fill="#0e5a4c" />
      <path
        d="M30 118c0-9 4-15 13-17l20-20c4-4 9-6 15-6h36c7 0 12 3 16 8l13 15c12 1 17 6 17 15v5z"
        fill="#ffcf3f"
      />
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
