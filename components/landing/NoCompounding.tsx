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
              <defs>
                <marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#64748b" />
                </marker>
              </defs>
              <g className="stroke-[#64748b] stroke-[1.7]" fill="none" markerEnd="url(#flow-arrow)">
                <path className="draw-in" d="M55,60 L132,30" />
                <path className="draw-in" d="M55,60 L132,110" />
                <path className="draw-in" d="M166,30 L228,70" />
                <path className="draw-in" d="M166,110 L228,70" />
              </g>

              <rect x="30" y="48" width="34" height="24" rx="3" className="fill-[#dcfce7] stroke-[#15803d] stroke-[1.5]" />
              <text x="47" y="64" textAnchor="middle" className="fill-[#166534] font-mono text-[9px]">A</text>

              <rect x="132" y="18" width="34" height="24" rx="3" className="fill-[#fef3c7] stroke-[#b45309] stroke-[1.5]" />
              <text x="149" y="34" textAnchor="middle" className="fill-[#92400e] font-mono text-[9px]">B</text>

              <rect x="132" y="98" width="34" height="24" rx="3" className="fill-[#fef3c7] stroke-[#b45309] stroke-[1.5]" />
              <text x="149" y="114" textAnchor="middle" className="fill-[#92400e] font-mono text-[9px]">C</text>

              <rect x="228" y="58" width="34" height="24" rx="3" className="fill-[#dbeafe] stroke-[#1d4ed8] stroke-[1.6]" />
              <text x="245" y="74" textAnchor="middle" className="fill-[#1e40af] font-mono text-[9px]">D</text>

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
              date is always <strong><span className="mono">MAX(endDate)</span></strong>{" "}
              across its direct prerequisites &mdash; <strong>never a sum across
              paths.</strong>
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
              &mdash; a <strong>compounding error</strong> that gets worse with every extra
              convergence point in a real project.
            </p>
            <p>
              This is asserted in a unit test, not just demoed by hand: build
              A&rarr;B&rarr;D and A&rarr;C&rarr;D, delay A, and check D moves
              by <strong>exactly three days.</strong>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}