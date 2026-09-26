import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { NoCompounding } from "@/components/landing/NoCompounding";
import { Rules } from "@/components/landing/Rules";
import { Closer } from "@/components/landing/Closer";

export default function Home() {
  return (
    <main className="bg-paper text-ink">
      <Nav />
      <Hero />
      <NoCompounding />
      <Rules />
      <Closer />
    </main>
  );
}