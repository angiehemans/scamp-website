import type { Metadata } from "next";
import Nav from "@/components/Nav/Nav";
import Hero from "@/components/Hero/Hero";
import LogoBar from "@/components/LogoBar/LogoBar";
import FeatureOne from "@/components/FeatureOne/FeatureOne";
import FeatureTwo from "@/components/FeatureTwo/FeatureTwo";
import FeatureThree from "@/components/FeatureThree/FeatureThree";
import FeatureFour from "@/components/FeatureFour/FeatureFour";
import UseCases from "@/components/UseCases/UseCases";
import FAQ from "@/components/FAQ/FAQ";
import Download from "@/components/Download/Download";
import Footer from "@/components/Footer/Footer";
import JsonLd from "@/components/JsonLd/JsonLd";
import { softwareApplicationSchema } from "@/lib/schema";
import { HOMEPAGE_FAQ_SHORT } from "@/lib/faq-content";

export const metadata: Metadata = {
  title: {
    absolute: "Scamp — A Figma alternative for designers",
  },
  description:
    "Scamp is a free, open-source Figma alternative for designers. Full visual and CSS control on a local canvas. Use AI coding agents on your real design files, and hand off production-ready TSX and CSS to developers.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <LogoBar />
        <FeatureOne />
        <FeatureTwo />
        <FeatureThree />
        <FeatureFour />
        <UseCases />
        <FAQ items={HOMEPAGE_FAQ_SHORT} />
        <Download />
      </main>
      <Footer />
      <JsonLd data={softwareApplicationSchema()} />
    </>
  );
}
