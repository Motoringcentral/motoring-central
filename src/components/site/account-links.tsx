import Link from "next/link";
import { logOut } from "@/app/actions/account";
import { getSession } from "@/lib/session";

export async function AccountLinks() {
  const session = await getSession();
  if (!session) return <LoggedOutLinks />;

  return (
    <>
      <span>Hi, {session.user.name.split(" ")[0]}</span>
      <form action={logOut}>
        <button type="submit" className="cursor-pointer font-semibold underline">
          Log out
        </button>
      </form>
    </>
  );
}

export function LoggedOutLinks() {
  return (
    <>
      <Link href="/login" className="underline">
        Log in
      </Link>
      <Link href="/register" className="underline">
        Register free
      </Link>
    </>
  );
}
