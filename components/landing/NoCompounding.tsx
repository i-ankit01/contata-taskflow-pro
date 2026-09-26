export function NoCompounding() {
  return (
    <section id="compounding" className="border-t border-line py-20 sm:py-24">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        <div className="mb-12 max-w-[640px]">
          <h2 className="font-display text-[26px] font-semibold leading-[1.15] sm:text-[36px]">
            Delays don&rsquo;t add up. They converge.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[16px] text-dim">
            When two paths lead to the same task, a naive tool adds both
            delays together. TaskFlow Pro&rsquo;s propagation engine visits
            every task once, in topological order, and takes the latest
            incoming date &mdash; never the sum.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-2">
          <div className="rounded-md border border-line bg-white p-6">
            <svg viewBox="0 0 380 200" className="block h-auto w-full">
              <g className="stroke-line-strong">
                <path d="M55,60 L150,30" />
                <path d="M55,60 L150,110" />
                <path d="M150,30 L245,70" />
                <path d="M150,110 L245,70" />
              </g>

              <rect x="30" y="48" width="34" height="24" rx="3" className="stroke-ink stroke-[1.4]" fill="none" />
              <text x="47" y="64" textAnchor="middle" className="fill-ink font-mono text-[9px]">A</text>

              <rect x="132" y="18" width="34" height="24" rx="3" className="stroke-ink stroke-[1.4]" fill="none" />
              <text x="149" y="34" textAnchor="middle" className="fill-dim font-mono text-[9px]">B</text>

              <rect x="132" y="98" width="34" height="24" rx="3" className="stroke-ink stroke-[1.4]" fill="none" />
              <text x="149" y="114" textAnchor="middle" className="fill-dim font-mono text-[9px]">C</text>

              <rect x="228" y="58" width="34" height="24" rx="3" className="stroke-ink stroke-[1.4]" fill="none" />
              <text x="245" y="74" textAnchor="middle" className="fill-ink font-mono text-[9px]">D</text>

              <text x="47" y="100" textAnchor="middle" className="fill-ink font-mono text-[9px]">+3d</text>
              <text x="149" y="10" textAnchor="middle" className="fill-dim font-mono text-[9px]">start = A.end</text>
              <text x="149" y="138" textAnchor="middle" className="fill-dim font-mono text-[9px]">start = A.end</text>
              <text x="245" y="118" textAnchor="middle" className="fill-ink font-mono text-[10px]">
                start = MAX(B.end, C.end)
              </text>
            </svg>
            <div className="mt-5 rounded border border-line-strong px-4 py-3.5 font-mono text-[13px]">
              D.endDate shifts <strong>+3 days</strong> &mdash; not +6
            </div>
          </div>

          <div className="[&_p]:mb-4 [&_p]:text-[15.5px] [&_p]:text-dim [&_p:last-child]:mb-0 [&_strong]:font-medium [&_strong]:text-ink [&_span.mono]:font-mono [&_span.mono]:text-ink">
            <p>
              <strong>The rule:</strong> a downstream task&rsquo;s new start
              date is always <span className="mono">MAX(endDate)</span>{" "}
              across its direct prerequisites &mdash; never a sum across
              paths.
            </p>
            <p>
              Delay <span className="mono">A</span> by three days. Both{" "}
              <span className="mono">B</span> and{" "}
              <span className="mono">C</span> inherit that same three-day
              shift on their own paths. <span className="mono">D</span>{" "}
              takes the later of the two, which is identical either way, so
              it also moves by three days.
            </p>
            <p>
              A tool that sums per incoming edge would land{" "}
              <span className="mono">D</span> six days late instead of three
              &mdash; a compounding error that gets worse with every extra
              convergence point in a real project.
            </p>
            <p>
              This is asserted in a unit test, not just demoed by hand: build
              A&rarr;B&rarr;D and A&rarr;C&rarr;D, delay A, and check D moves
              by exactly three days.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}