import { Link } from "react-router-dom";

import { useLocalization } from "../../app/localization";
import { AppFrame } from "../../components/AppFrame";

export function PublicLanding() {
  const { t } = useLocalization();
  return (
    <AppFrame>
      <div className="public-page">
        <section className="public-hero" aria-labelledby="public-title">
          <div className="public-hero__copy">
            <p className="eyebrow">{t("publicEyebrow")}</p>
            <h1 id="public-title">{t("publicTitle")}</h1>
            <p className="public-hero__intro">{t("publicIntro")}</p>
            <div className="public-hero__actions">
              <Link className="button button--primary" to="/login">
                {t("publicPrimary")}
              </Link>
              <Link className="button button--secondary" to="/expo">
                {t("publicExpo")}
              </Link>
            </div>
          </div>
          <div className="public-hero__visual" aria-hidden="true">
            <span className="pulse-line" />
            <div className="hero-metric hero-metric--one"><span>HR</span><strong>—</strong></div>
            <div className="hero-metric hero-metric--two"><span>SpO₂</span><strong>—</strong></div>
            <div className="hero-grid" />
          </div>
        </section>
        <section className="public-principles" aria-label="Platform principles">
          <article>
            <span className="principle-number">01</span>
            <h2>{t("publicAuthorityTitle")}</h2>
            <p>{t("publicAuthorityBody")}</p>
          </article>
          <article>
            <span className="principle-number">02</span>
            <h2>{t("publicBilingualTitle")}</h2>
            <p>{t("publicBilingualBody")}</p>
          </article>
          <article>
            <span className="principle-number">03</span>
            <h2>{t("publicRecoveryTitle")}</h2>
            <p>{t("publicRecoveryBody")}</p>
          </article>
        </section>
      </div>
    </AppFrame>
  );
}
