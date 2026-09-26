import { DependencyGraph } from "./DependencyGraph";

export function Hero() {
  return (
    <header className="py-14 sm:py-20">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-12 px-5 sm:px-8 md:grid-cols-[1.05fr_1fr] md:gap-16">
        <div className="fade-up">
          <div className="mb-4 text-[13px] text-dim">
            dependency-aware task boards <span className="font-mono text-ink">/ v1</span>
          </div>
          <h1 className="font-display text-[34px] font-semibold leading-[1.08] sm:text-[44px] lg:text-[54px]">
            Kanban that knows
            <br />
            what depends on what.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] text-dim">
            Most boards let you drag a card to &ldquo;Done&rdquo; whether or
            not the work behind it is finished. TaskFlow Pro won&rsquo;t. A
            task is only Ready when every prerequisite actually is &mdash;
            checked against a real dependency graph, every time you look.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <a
              href="#start"
              className="rounded border border-ink bg-ink px-[22px] py-3 text-[14.5px] font-medium text-paper transition-opacity hover:opacity-85"
            >
              See the demo flow
            </a>
            <a
              href="#rules"
              className="rounded border border-line-strong px-[22px] py-3 text-[14.5px] font-medium text-ink transition-colors hover:border-ink"
            >
              How the engine works
            </a>
          </div>
          <div className="mt-7 flex flex-wrap gap-4.5 text-[12.5px] text-dim">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-[9px] w-[9px] rounded-[2px] bg-ink" />
              Done
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-[9px] w-[9px] rounded-[2px] border-[1.5px] border-ink" />
              Ready
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-[9px] w-[9px] rounded-[2px] border-[1.5px] border-dashed border-line-strong" />
              Blocked
            </span>
          </div>
        </div>

        <div
          className="fade-up rounded-md border border-line bg-white p-6 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]"
          style={{ animationDelay: ".15s" }}
        >
          <DependencyGraph />
        </div>
      </div>
    </header>
  );
}