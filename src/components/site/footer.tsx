import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-page px-4 pb-14">
      <div className="mt-8 border-t border-line pt-4 text-center text-[.82rem] text-muted">
        © The Motoring Central Ltd.{" "}
        <Link href="/breakdown" className="underline">
          Breakdown cover
        </Link>{" "}
        <Link href="/network" className="underline">
          Join the network
        </Link>{" "}
        <Link href="/about" className="underline">
          About us
        </Link>{" "}
        <Link href="/terms" className="underline">
          Terms and conditions
        </Link>
      </div>
    </footer>
  );
}
