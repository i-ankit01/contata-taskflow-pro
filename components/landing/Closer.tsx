import Link from "next/link";

export function Closer() {
  return (
    <section id="start" className="border-t border-line py-20 sm:py-24">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="font-display text-[28px] font-semibold leading-[1.14] sm:text-[42px]">
            Built to be checked, not taken on faith.
          </h2>
          <p className="mt-4 text-[16px] text-dim">
            Ten seeded tasks, twelve dependencies, one convergence point that
            proves the propagation math. Walk the demo, or open the graph
            engine and read the tests yourself.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <Link
              href="/projects"
              className="rounded border border-black bg-black px-[22px] py-3 text-[14.5px] font-medium text-white transition-opacity hover:opacity-85"
            >
              Open the board
            </Link>
            <a
              href="#"
              className="rounded border border-line-strong px-[22px] py-3 text-[14.5px] font-medium text-ink transition-colors hover:border-ink"
            >
              View source
            </a>
          </div>
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-7 text-[13px] text-dim">
          <span>TaskFlow Pro — dependency engine for real project graphs</span>
          <span className="flex flex-wrap gap-4.5">
            <a className="hover:text-ink" href="#compounding">
              Propagation
            </a>
            <a className="hover:text-ink" href="#rules">
              Guarantees
            </a>
            <a className="hover:text-ink" href="#start">
              Get started
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}