import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="in">
        <span>&copy; The Motoring Central Ltd</span>
        <nav aria-label="Footer">
          <Link href="/services">Our services</Link>
          <Link href="/about">About us</Link>
          <Link href="/terms">Terms and conditions</Link>
        </nav>
      </div>
    </footer>
  );
}
