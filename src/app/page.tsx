import { EverythingWeOffer } from "@/components/home/offers";
import { Hero } from "@/components/home/hero";
import { RegCheck } from "@/components/home/reg-check";
import { SeeItInAction } from "@/components/home/scenes";
import {
  BreakdownPromo,
  HowItWorks,
  PopularRepairs,
  Reviews,
  Stats,
  TrustStrip,
  VettedPromo,
  WhyChooseUs,
} from "@/components/home/sections";

export default function Home() {
  return (
    <>
      <Hero />
      <main className="mx-auto max-w-page px-4 pt-5.5">
        <RegCheck />
        <TrustStrip />
        <EverythingWeOffer />
        <PopularRepairs />
        <HowItWorks />
        <Stats />
        <WhyChooseUs />
        <VettedPromo />
        <SeeItInAction />
        <Reviews />
        <BreakdownPromo />
      </main>
    </>
  );
}
