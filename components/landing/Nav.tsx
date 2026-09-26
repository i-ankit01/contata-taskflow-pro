export function Nav() {
  return (
    <nav className="sticky top-0 z-20 bg-gradient-to-b from-paper via-paper to-transparent pb-5 pt-[calc(20px+env(safe-area-inset-top,0px))]">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5 font-display text-[17px] font-semibold">
          <span className="relative inline-block h-[11px] w-[11px] rounded-[2px] border-[1.5px] border-ink">
            <span className="absolute left-[14px] top-1 h-[1.5px] w-4 bg-ink" />
          </span>
          TaskFlow Pro
        </div>
        <div className="hidden gap-7 text-sm text-dim sm:flex">
          <a className="transition-colors hover:text-ink" href="#compounding">
            Propagation
          </a>
          <a className="transition-colors hover:text-ink" href="#rules">
            Guarantees
          </a>
          <a className="transition-colors hover:text-ink" href="#start">
            Get started
          </a>
        </div>
      </div>
    </nav>
  );
}