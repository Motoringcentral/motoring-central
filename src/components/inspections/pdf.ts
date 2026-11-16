// Shared PDF building for the inspection and PDI forms (A4, brand header, page footers).
// jsPDF is loaded only when someone presses "Finish & save PDF", so it doesn't slow the page.

import type { jsPDF as JsPDF } from "jspdf";
import { DAMAGE_COLOURS, type Damage, type Photo } from "./shared";

export const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const NAVY = hex("#0B1C35");
export const SKY = hex("#38BDF8");
export const YEL = hex("#FFD43B");
export const MUT = hex("#5A6B82");
export const RED = hex("#E5484D");
export const GRN = hex("#1F9D55");
export const AMB = hex("#B45309");

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="30" fill="#0B1C35"/><path d="M30.3 89.7 A42 42 0 1 1 89.7 89.7" fill="none" stroke="#38BDF8" stroke-width="7" stroke-linecap="round"/><polyline points="38,82 38,46 60,68 82,46 82,82" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="68" r="8" fill="#FFD43B"/></svg>';

function svgToPng(svg: string, w: number, h: number) {
  return new Promise<string | null>((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d")!;
      x.fillStyle = "#fff";
      x.fillRect(0, 0, w, h);
      x.drawImage(im, 0, 0, w, h);
      res(c.toDataURL("image/png"));
    };
    im.onerror = () => res(null);
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

function imgSize(src: string) {
  return new Promise<[number, number]>((r) => {
    const i = new Image();
    i.onload = () => r([i.width, i.height]);
    i.onerror = () => r([4, 3]);
    i.src = src;
  });
}

export type Pdf = {
  doc: JsPDF;
  W: number;
  M: number;
  y: number;
  need: (h: number) => void;
  heading: (t: string, extra?: number) => void;
  pairs: (p: [string, unknown][]) => void;
  para: (title: string, text?: string) => void;
};

export async function startPdf(title: string, subtitle: string): Promise<Pdf> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210,
    M = 14;
  const p = { doc, W, M, y: 44 } as Pdf;
  p.need = (h) => {
    if (p.y + h > 282) {
      doc.addPage();
      p.y = 16;
    }
  };
  p.heading = (t, ex = 0) => {
    p.need(12 + ex);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(t, M, p.y);
    doc.setDrawColor(...SKY);
    doc.setLineWidth(0.6);
    doc.line(M, p.y + 1.8, W - M, p.y + 1.8);
    p.y += 7;
  };
  p.pairs = (pairs) => {
    doc.setFontSize(9);
    for (let i = 0; i < pairs.length; i += 2) {
      p.need(7);
      [pairs[i], pairs[i + 1]].forEach((kv, j) => {
        if (!kv) return;
        const x = M + j * 91;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUT);
        doc.text(kv[0], x, p.y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY);
        const v = kv[1] == null || kv[1] === "" ? "-" : String(kv[1]);
        doc.text(v.slice(0, 46), x + 32, p.y);
      });
      p.y += 6;
    }
    p.y += 2;
  };
  p.para = (t, txt) => {
    if (!txt) return;
    p.heading(t);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    (doc.splitTextToSize(txt, W - 2 * M) as string[]).forEach((l) => {
      p.need(5);
      doc.text(l, M, p.y);
      p.y += 4.6;
    });
    p.y += 3;
  };

  // brand header
  doc.setFillColor(...SKY);
  doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(...NAVY);
  doc.rect(0, 34, W, 2.5, "F");
  doc.setFillColor(...YEL);
  doc.rect(0, 34, 50, 2.5, "F");
  const logo = await svgToPng(LOGO_SVG, 240, 240);
  if (logo) doc.addImage(logo, "PNG", M, 6, 22, 22);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("T H E", M + 26, 11);
  doc.setFontSize(17);
  doc.text("MOTORING", M + 26, 18);
  doc.setFillColor(...NAVY);
  doc.roundedRect(M + 26, 20.5, 30, 6.5, 1.2, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text("C E N T R A L", M + 28.5, 25.1);
  doc.setTextColor(...NAVY);
  doc.setFontSize(15);
  doc.text(title, W - M, 16, { align: "right" });
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, W - M, 22, { align: "right" });
  doc.text("motoringcentral.co.uk", W - M, 27, { align: "right" });
  return p;
}

/** Car diagram with pins on the left, numbered list of marks on the right. */
export async function damageSection(p: Pdf, svg: SVGSVGElement | null, damage: Damage[], emptyText: string) {
  const { doc, M, W } = p;
  let dimg: string | null = null;
  if (svg) {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "600");
    clone.setAttribute("height", "1080");
    clone.removeAttribute("class");
    dimg = await svgToPng(new XMLSerializer().serializeToString(clone), 600, 1080);
  }
  p.need(92);
  const top = p.y;
  if (dimg) doc.addImage(dimg, "PNG", M, p.y, 50, 90);
  let ly = p.y + 3;
  const lx = M + 56;
  doc.setFontSize(9);
  if (!damage.length) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(emptyText, lx, ly);
  }
  damage.forEach((d, i) => {
    if (ly + 6 > 282) {
      doc.addPage();
      ly = 16;
    }
    doc.setFillColor(...hex(DAMAGE_COLOURS[d.type]));
    doc.circle(lx + 2.5, ly - 1.2, 2.6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(String(i + 1), lx + 2.5, ly, { align: "center" });
    doc.setTextColor(...NAVY);
    doc.setFontSize(9);
    doc.text(`${d.where} – ${d.type}${d.size ? " – " + d.size : ""}`, lx + 7, ly);
    if (d.note) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUT);
      const nl = doc.splitTextToSize(d.note, W - M - lx - 7) as string[];
      doc.text(nl, lx + 7, ly + 4.5);
      ly += 4.5 * nl.length;
    }
    ly += 7;
  });
  // if the list ran onto a new page, carry on below it there
  p.y = ly < top ? ly + 2 : Math.max(top + 94, ly + 2);
}

export function signatureSection(
  p: Pdf,
  boxes: [label: string, img: string | undefined, name: string | undefined][],
  absentText: string | null,
  legal: string,
) {
  const { doc, M, W } = p;
  p.need(40);
  const sw = (W - 2 * M - 8) / 2;
  boxes.forEach(([lab, img, nm], j) => {
    const x = M + j * (sw + 8);
    doc.setDrawColor(...hex("#D6E2EE"));
    doc.setLineWidth(0.3);
    doc.roundedRect(x, p.y, sw, 26, 2, 2);
    if (img) doc.addImage(img, "PNG", x + 2, p.y + 1, sw - 4, 24);
    else if (j === 1 && absentText) {
      doc.setFontSize(9);
      doc.setTextColor(...MUT);
      doc.text(absentText, x + 4, p.y + 14);
    }
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.text(`${lab}: ${nm || ""}`, x, p.y + 31);
  });
  p.y += 37;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUT);
  const leg = doc.splitTextToSize(legal, W - 2 * M) as string[];
  p.need(leg.length * 4);
  doc.text(leg, M, p.y);
  p.y += leg.length * 4;
}

export async function photoPages(p: Pdf, photos: Photo[]) {
  if (!photos.length) return;
  const { doc, M, W } = p;
  doc.addPage();
  p.y = 16;
  p.heading(`Photos (${photos.length})`);
  const pw = (W - 2 * M - 6) / 2;
  let col = 0,
    rowH = 0;
  for (const [i, ph] of photos.entries()) {
    const [iw, ih] = await imgSize(ph.src);
    const h = Math.min((pw * ih) / iw, 110);
    if (col === 0) {
      p.need(119);
      rowH = 0;
    }
    const x = M + col * (pw + 6);
    doc.addImage(ph.src, "JPEG", x, p.y, pw, h);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUT);
    doc.text(`Photo ${i + 1} · ${ph.t}`, x, p.y + h + 4);
    rowH = Math.max(rowH, h);
    if (col === 1 || i === photos.length - 1) {
      p.y += rowH + 9;
      col = 0;
    } else col = 1;
  }
}

export function finishPdf(p: Pdf, footer: string, filename: string) {
  const { doc, W } = p;
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUT);
    doc.text(`${footer} · Page ${i} of ${pages}`, W / 2, 291, { align: "center" });
  }
  const blob = doc.output("blob");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return blob;
}
