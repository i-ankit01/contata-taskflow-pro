import { ok, fail } from "@/lib/api-response";
import { generateDependencySuggestions } from "@/lib/services/aiService";
import { checkRateLimit, getClientKey } from "@/lib/services/rateLimiter";

export async function POST(req: Request) {
  const key = getClientKey(req);
  const { allowed, resetInMs } = checkRateLimit(key);

  if (!allowed) {
    return fail(
      `Rate limit exceeded. Try again in ${Math.ceil(resetInMs / 1000)}s.`,
      429
    );
  }

  try {
    const suggestions = await generateDependencySuggestions();
    return ok({ suggestions });
  } catch (e) {
    return fail(
      e instanceof Error ? e.message : "Failed to generate AI suggestions",
      500
    );
  }
}