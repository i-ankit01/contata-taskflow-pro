"use client";

import { useEffect, useState } from "react";

export function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-20 pb-5 pt-[calc(20px+env(safe-area-inset-top,0px))] transition-[background-color,backdrop-filter,box-shadow] duration-300 ${
        isScrolled
          ? "bg-paper/85 shadow-[0_1px_0_rgba(15,23,42,0.08)] backdrop-blur-md"
          : "bg-gradient-to-b from-paper via-paper to-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 sm:px-8">
        <div className="font-display text-[20px] font-semibold">
          TaskFlow Pro
        </div>
        <div className="hidden gap-1 text-[15px] text-dim sm:flex">
          <a className="rounded-md px-3 py-2 transition-colors hover:bg-gray-100 hover:text-ink" href="#compounding">
            Propagation
          </a>
          <a className="rounded-md px-3 py-2 transition-colors hover:bg-gray-100 hover:text-ink" href="#rules">
            Guarantees
          </a>
          <a className="rounded-md px-3 py-2 transition-colors hover:bg-gray-100 hover:text-ink" href="#start">
            Get started
          </a>
        </div>
      </div>
    </nav>
  );
}