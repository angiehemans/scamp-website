import styles from "./LogoBar.module.css";

export default function LogoBar() {
  return (
    <section className={styles.bar}>
      <p className={styles.text}>
        Free · Works offline · Plain TSX and CSS files on your local disk
      </p>
    </section>
  );
}
