import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import SignInForm from "./SignInForm";

/**
 * Someone who is already signed in has nothing to do here, so they go straight
 * to the dashboard instead of being asked for a password they already gave.
 *
 * The one exception is a desktop handoff (`?desktop=1`): the app opened this
 * page to get a code, and bouncing to the dashboard would strand it. The form
 * renders, and offers to continue with the existing session — see
 * ContinueToDesktop.
 *
 * Decided on the server so the redirect happens before any form is painted:
 * a client-side check would flash the form first, then jump.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ desktop?: string }>;
}) {
  const [{ desktop }, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  if (user && desktop !== "1") redirect("/dashboard");

  return <SignInForm signedInAs={user?.email ?? null} />;
}
