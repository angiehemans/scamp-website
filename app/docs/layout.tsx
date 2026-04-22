import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import { getDocEntries } from "@/lib/docs";
import Sidebar from "./Sidebar";
import styles from "./docs.module.css";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const entries = getDocEntries();

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <Sidebar entries={entries} />
          <div className={styles.content}>{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
