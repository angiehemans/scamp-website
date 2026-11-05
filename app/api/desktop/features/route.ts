import { currentApiUser, unauthorized } from "@/lib/api-auth";
import { featuresFor } from "@/lib/features";

/**
 * Which flagged features the signed-in desktop app may show.
 *
 * Called at launch, after sign-in, and with each heartbeat. The app caches
 * the last answer so it keeps working offline, and treats "never asked" as
 * off. See lib/features.ts.
 */
export async function GET() {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  return Response.json(featuresFor(user));
}
