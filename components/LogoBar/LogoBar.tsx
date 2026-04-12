import styles from "./LogoBar.module.css";

export default function LogoBar() {
  return (
    <section className={styles.bar}>
      <p className={styles.text}>
        Free and open source. Your files stay on your machine.
      </p>
    </section>
  );
}
