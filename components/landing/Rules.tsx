const RULES = [
  {
    num: "01",
    title: "Cycles are rejected before they exist",
    body: "Every new dependency is checked with a graph walk first. If it would create a loop, the request fails and nothing is written — the existing graph is untouched.",
  },
  {
    num: "02",
    title: "Every task is visited once",
    body: "Propagation runs in topological order. No task's schedule is recomputed twice in the same pass, so delays can't silently stack.",
  },
  {
    num: "03",
    title: "Ready and Blocked are never stored",
    body: "There's no status column for it. Readiness is recalculated from live task states and the dependency table on every read.",
  },
  {
    num: "04",
    title: "The model proposes, a person decides",
    body: "AI-suggested dependencies live only in the browser until someone accepts one — then it passes through the same cycle check as a manual dependency. There is no other way in.",
  },
];

export function Rules() {
  return (
    <section id="rules" className="border-t border-line py-20 sm:py-24">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        <div className="mb-12 max-w-[640px]">
          <h2 className="font-display text-[26px] font-semibold leading-[1.15] sm:text-[36px]">
            Four rules the engine never breaks.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[16px] text-dim">
            The graph logic is a small set of pure functions with no database
            or UI code inside them &mdash; which is what makes these
            guarantees checkable, not just claimed.
          </p>
        </div>

        <div className="grid grid-cols-1 overflow-hidden rounded-md border border-line sm:grid-cols-2">
          {RULES.map((r, i) => (
            <div
              key={r.num}
              className={[
                "p-8",
                i % 2 === 0 ? "sm:border-r sm:border-line" : "",
                i < RULES.length - 2 ? "border-b border-line" : "",
              ].join(" ")}
            >
              <span className="mb-3.5 block font-mono text-[12.5px] text-dim">
                {r.num}
              </span>
              <h3 className="mb-2.5 font-display text-[18px] font-semibold">
                {r.title}
              </h3>
              <p className="text-[14.5px] text-dim">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}