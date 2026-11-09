// "See it in action" illustrations, ported from the prototype. The SVG markup
// is static and authored here, so rendering it as HTML is safe.

const car = (x: number, y: number, c: string, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 30c0-8 3-13 10-14l14-12c3-3 6-4 10-4h28c4 0 8 2 11 5l9 11c8 1 12 4 12 10v4z" fill="${c}"/><path d="M26 16l11-10c2-2 4-2 6-2h22c2 0 4 1 6 3l7 9z" fill="#e6f4fb"/><circle cx="20" cy="33" r="10" fill="#111"/><circle cx="20" cy="33" r="4" fill="#cfd8dc"/><circle cx="84" cy="33" r="10" fill="#111"/><circle cx="84" cy="33" r="4" fill="#cfd8dc"/></g>`;

const person = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><rect x="-9" y="22" width="7" height="18" fill="#2b3a47"/><rect x="2" y="22" width="7" height="18" fill="#2b3a47"/><rect x="-11" y="0" width="22" height="26" rx="4" fill="#ff7a1a"/><rect x="-11" y="12" width="22" height="4" fill="#ffe082"/><circle cx="0" cy="-9" r="9" fill="#f1c27d"/><path d="M-10 -11c0-8 5-11 10-11s10 3 10 11z" fill="#ffcf3f"/></g>`;

const star = (x: number, y: number, s: number) =>
  `<path fill="#fff" transform="translate(${x} ${y}) scale(${s})" d="M0-10L3-3L10 0L3 3L0 10L-3 3L-10 0L-3-3Z"/>`;

const SCENES: { title: string; caption: string; sky: [string, string]; body: string }[] = [
  {
    title: "Mobile mechanic",
    caption: "Fixed at your door",
    sky: ["#bfe3f0", "#e9f6f2"],
    body:
      '<path d="M150 118V70l36-26 36 26v48z" fill="#1d9a84"/><rect x="178" y="92" width="16" height="26" fill="#08362f"/><rect x="156" y="82" width="12" height="12" fill="#e6f4fb"/>' +
      car(12, 75, "#ffcf3f") +
      person(130, 78) +
      '<rect x="108" y="108" width="22" height="10" rx="2" fill="#d93025"/>',
  },
  {
    title: "Partner garages",
    caption: "Drive in, drive out",
    sky: ["#cfe3f0", "#eef3f6"],
    body:
      '<rect x="20" y="40" width="200" height="78" fill="#cfd8dc"/><path d="M12 42L120 16l108 26z" fill="#587080"/><rect x="40" y="62" width="160" height="56" fill="#2b3a47"/><rect x="92" y="24" width="56" height="12" rx="2" fill="#0f6b5c"/><text x="120" y="33" font-size="8" font-weight="700" fill="#fff" text-anchor="middle" font-family="sans-serif">GARAGE</text><rect x="64" y="86" width="5" height="32" fill="#9aa8b0"/><rect x="171" y="86" width="5" height="32" fill="#9aa8b0"/>' +
      car(68, 52, "#7fb0cf", 0.85),
  },
  {
    title: "Recovery",
    caption: "Towed, any time",
    sky: ["#f3d9a8", "#fbeed4"],
    body:
      '<rect x="14" y="96" width="196" height="8" fill="#2b3a47"/><rect x="66" y="90" width="144" height="6" fill="#cfd8dc"/><path d="M14 96V66c0-3 2-5 5-5h20l12 15v20z" fill="#fff"/><path d="M22 66h14l8 10H22z" fill="#bfe3f0"/><rect x="22" y="53" width="14" height="7" rx="2" fill="#ff7a1a"/><circle cx="36" cy="108" r="10" fill="#111"/><circle cx="104" cy="108" r="10" fill="#111"/><circle cx="188" cy="108" r="10" fill="#111"/>' +
      car(86, 54, "#ffcf3f", 0.85),
  },
  {
    title: "Mobile tyres",
    caption: "Fitted where you park",
    sky: ["#d6e9d4", "#f0f7ee"],
    body: '<path d="M14 108V68c0-4 3-7 8-7h66c5 0 9 3 11 7l12 18c5 2 7 5 7 10v12z" fill="#fff"/><path d="M92 68l12 18H78V68z" fill="#bfe3f0"/><rect x="22" y="74" width="50" height="10" rx="2" fill="#0f6b5c"/><circle cx="42" cy="110" r="10" fill="#111"/><circle cx="104" cy="110" r="10" fill="#111"/><circle cx="184" cy="86" r="30" fill="#1b1b1b"/><circle cx="184" cy="86" r="19" fill="#9aa8b0"/><circle cx="184" cy="86" r="7" fill="#cfd8dc"/><g stroke="#5b6a73" stroke-width="3"><path d="M184 68v36M166 86h36M171 73l26 26M197 73l-26 26"/></g>',
  },
  {
    title: "Full valet",
    caption: "Spotless, inside and out",
    sky: ["#cfe9f7", "#f3fafc"],
    body:
      car(40, 75, "#7fb0cf") +
      star(60, 50, 1) +
      star(128, 40, 0.7) +
      star(30, 72, 0.6) +
      star(150, 70, 0.8) +
      '<path d="M180 118l5-24h26l5 24z" fill="#ff7a1a"/><ellipse cx="198" cy="94" rx="13" ry="4" fill="#ffe082"/><circle cx="192" cy="88" r="5" fill="#fff"/><circle cx="203" cy="84" r="4" fill="#fff"/>',
  },
  {
    title: "Bodywork and alloys",
    caption: "Smart repairs to accident damage",
    sky: ["#f6d6c8", "#fcf0ea"],
    body:
      car(14, 75, "#38BDF8") +
      '<circle cx="128" cy="88" r="5" fill="#fff" opacity=".7"/><circle cx="136" cy="82" r="7" fill="#fff" opacity=".5"/><circle cx="144" cy="90" r="4" fill="#fff" opacity=".6"/><path d="M146 84h12l6-4v10l-6-4h-12z" fill="#587080"/><rect x="154" y="90" width="5" height="10" rx="1" fill="#2b3a47"/><g transform="translate(200 88)"><circle r="24" fill="#2b3a47"/><circle r="20" fill="#e8eef1"/><circle r="7" fill="#9aa9b3"/><path d="M0-7L-3-19h6zM6.7-2.2L18-9l2 5zM4.1 5.7L12 16l-5 3zM-4.1 5.7L-7 19l-5-3zM-6.7-2.2L-20-4l2-5z" fill="#9aa9b3"/></g>' +
      star(228, 58, 0.6),
  },
  {
    title: "MOT tests",
    caption: "Booked at approved centres",
    sky: ["#e2d6f3", "#f4effb"],
    body:
      car(20, 75, "#ffcf3f") +
      '<circle cx="176" cy="62" r="28" fill="#1d9a84"/><path d="M163 62l9 10 17-20" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><rect x="152" y="96" width="48" height="14" rx="3" fill="#0f6b5c"/><text x="176" y="106" font-size="9" font-weight="700" fill="#fff" text-anchor="middle" font-family="sans-serif">MOT PASS</text>',
  },
];

export function SeeItInAction() {
  return (
    <>
      <h2 className="mt-7.5 mb-3 text-[1.25rem] font-bold">See it in action</h2>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1.5 pb-3.5">
        {SCENES.map((scene, i) => (
          <div
            key={scene.title}
            className="max-w-[290px] flex-[0_0_76%] snap-start overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_8px_22px_rgba(0,0,0,.10)]"
          >
            <svg
              viewBox="0 0 240 130"
              role="img"
              aria-label={`${scene.title} illustration`}
              className="block h-auto w-full"
              dangerouslySetInnerHTML={{
                __html: `<defs><linearGradient id="sg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.sky[0]}"/><stop offset="1" stop-color="${scene.sky[1]}"/></linearGradient></defs><rect width="240" height="130" fill="url(#sg${i})"/><rect y="118" width="240" height="12" fill="#a9b8c0"/>${scene.body}`,
              }}
            />
            <b className="block px-3.5 pt-2.5 font-display text-[1.05rem]">{scene.title}</b>
            <small className="block px-3.5 pb-3.5 text-muted">{scene.caption}</small>
          </div>
        ))}
      </div>
    </>
  );
}
