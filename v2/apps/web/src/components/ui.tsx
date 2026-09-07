import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode
} from "react";

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <button className={`button button--${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function Panel({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={`panel ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function SectionHeader({
  id,
  title,
  subtitle,
  action
}: {
  id?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        <h2 id={id}>{title}</h2>
        {subtitle === undefined ? null : <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "critical" | "information";
}) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span className="status-badge__mark" aria-hidden="true" />
      {children}
    </span>
  );
}

export function LoadingState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="state-view" role="status" aria-live="polite">
      <div className="loading-indicator" aria-hidden="true" />
      <h1>{title}</h1>
      {body === undefined ? null : <p>{body}</p>}
      <div className="skeleton-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-view state-view--error" role="alert">
      <div className="state-icon" aria-hidden="true">!</div>
      <h1>{title}</h1>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__line" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
