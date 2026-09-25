import { useTheme } from "../app/theme";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { Link } from "react-router-dom";

import { useLocalization } from "../app/localization";
import { STUDENT_SHELL_LOCALES, type AuthSnapshot } from "../app/types";
import { Button } from "./ui";

export function LocaleControl() {
  const { locale, setLocale, t } = useLocalization();
  return (
    <div className="locale-control" role="group" aria-label={t("language")}>
      <button
        type="button"
        aria-pressed={locale === "en-US"}
        onClick={() => setLocale(STUDENT_SHELL_LOCALES.EN_US)}
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={locale === "ar-JO"}
        onClick={() => setLocale(STUDENT_SHELL_LOCALES.AR_JO)}
      >
        العربية
      </button>
    </div>
  );
}

export function AppFrame({
  children,
  auth,
  onSignOut
}: {
  children: React.ReactNode;
  auth?: AuthSnapshot;
  onSignOut?: () => void;
}) {
  const { t, locale } = useLocalization();
  const { theme, toggle } = useTheme();
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">{t("skipToContent")}</a>
      <header className="topbar">
        <Link className="brand" to="/" aria-label={t("brand")}>
          <Brand />
        </Link>
        <div className="topbar__actions">
          {auth?.status === "AUTHENTICATED" ? (
            <span className="auth-summary">
              {t("authenticatedAs")} <strong>{auth.display_name ?? "Learner"}</strong>
            </span>
          ) : null}
          <LocaleControl />
          <button type="button" className="theme-control" onClick={toggle}
            aria-label={locale === "ar-JO" ? (theme === "bright" ? "الوضع الداكن" : "الوضع الفاتح") : (theme === "bright" ? "Dark mode" : "Bright mode")}>
            <Icon name={theme === "bright" ? "moon" : "sun"} />
          </button>
          {auth?.status === "AUTHENTICATED" && onSignOut !== undefined ? (
            <Button type="button" variant="quiet" onClick={onSignOut}>
              {t("signOut")}
            </Button>
          ) : null}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">{t("footerAuthority")}</footer>
    </div>
  );
}
