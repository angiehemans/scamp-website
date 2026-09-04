import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import SignUpForm from "./SignUpForm";

/**
 * Same rule as sign-in: an existing session goes to the dashboard, except when
 * the desktop app opened this page and needs the handoff to finish — see
 * app/(app)/sign-in/page.tsx for the reasoning.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ desktop?: string }>;
}) {
  const [{ desktop }, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  if (user && desktop !== "1") redirect("/dashboard");

  return <SignUpForm signedInAs={user?.email ?? null} />;
}
