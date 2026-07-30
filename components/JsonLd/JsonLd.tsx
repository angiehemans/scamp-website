type Schema = Record<string, unknown>;

/**
 * Renders structured data as a single JSON-LD object.
 *
 * Deliberately not a top-level array. Both forms are valid JSON-LD, but a lot
 * of consumers — SEO tools, browser extensions, some crawlers — parse the
 * script and read `parsed["@context"]` directly, assuming an object. On an
 * array that is `undefined`, and calling a string method on it throws
 * (`undefined is not an object (evaluating 'r["@context"].toLowerCase')` in
 * Safari). Multiple entities go in an `@graph`, which is the canonical shape
 * for that and what Google documents.
 */
export default function JsonLd({ data }: { data: object | object[] }) {
  const items = (Array.isArray(data) ? data : [data]) as Schema[];
  const contexts = new Set(
    items.map((item) => item["@context"]).filter(Boolean),
  );

  let payload: unknown;
  if (items.length === 1) {
    payload = items[0];
  } else if (contexts.size === 1) {
    // Hoist the shared @context up and let @graph carry the entities.
    payload = {
      "@context": [...contexts][0],
      "@graph": items.map((item) => {
        const rest = { ...item };
        delete rest["@context"];
        return rest;
      }),
    };
  } else {
    // Mixed or missing contexts: each entity has to keep its own, so the array
    // form is the only correct representation.
    payload = items;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
