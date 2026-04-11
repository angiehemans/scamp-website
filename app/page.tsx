import Nav from "@/components/Nav/Nav";
import Hero from "@/components/Hero/Hero";
import LogoBar from "@/components/LogoBar/LogoBar";
import FeatureOne from "@/components/FeatureOne/FeatureOne";
import FeatureTwo from "@/components/FeatureTwo/FeatureTwo";
import FeatureThree from "@/components/FeatureThree/FeatureThree";
import FeatureFour from "@/components/FeatureFour/FeatureFour";
import Download from "@/components/Download/Download";
import Footer from "@/components/Footer/Footer";

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
        <Download />
      </main>
      <Footer />
    </>
  );
}
