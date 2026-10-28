import Image from "next/image";
import { ArrowRight, Headset } from "lucide-react";
import Link from "next/link";
import styles from "./login-page.module.css";

function MicrosoftMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M13 1h10v10H13z" />
      <path fill="#00a4ef" d="M1 13h10v10H1z" />
      <path fill="#ffb900" d="M13 13h10v10H13z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.imageWindow} aria-hidden="true">
        <Image
          src="/assets/ice-login-image.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.backgroundImage}
        />
      </div>

      <section className={styles.hero} aria-labelledby="login-hero-title">
        <div className={styles.heroCopy}>
          <h1 id="login-hero-title" className={styles.heroTitle}>
            A safer workplace for <span>everyone</span>
          </h1>
          <p className={styles.heroDescription}>
            Report incidents, manage emergencies and keep people safe with a
            faster, smarter and more connected response.
          </p>
        </div>
      </section>

      <section className={styles.loginArea} aria-labelledby="login-title">
        <div className={styles.support}>
          <Headset aria-hidden="true" className={styles.supportIcon} />
          <div>
            <p className={styles.supportTitle}>Need help?</p>
            <Link href="/support" className={styles.supportLink}>Contact ICT Support</Link>
          </div>
        </div>

        <div className={styles.loginCard}>
          <Image
            src="/evidence/ice-logo-removed-bg.png"
            alt="ICE logo"
            width={72}
            height={72}
            className={styles.loginLogo}
          />
          <h2 id="login-title" className={styles.loginTitle}>Welcome back</h2>
          <p className={styles.loginDescription}>Sign in to access the portal.</p>

          <Link
            href="/dashboard"
            className={styles.microsoftButton}
          >
            <MicrosoftMark />
            <span>Continue with Microsoft</span>
            <ArrowRight aria-hidden="true" className={styles.buttonArrow} />
          </Link>
        </div>

        <footer className={styles.footer}>
          <span aria-hidden="true" className={styles.footerRule} />
          <p>Powered by <strong>Techspecialist Limited</strong></p>
          <span aria-hidden="true" className={styles.footerRule} />
        </footer>
      </section>
    </main>
  );
}
