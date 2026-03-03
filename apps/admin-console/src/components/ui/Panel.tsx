import React, { PropsWithChildren } from "react";

type PanelProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  id?: string;
  actions?: React.ReactNode;
  wide?: boolean;
}>;

const Panel = ({ title, subtitle, id, actions, wide, children }: PanelProps) => {
  const className = wide ? "panel panel--wide" : "panel";
  return (
    <section className={className} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <header className="panel__header">
        <div>
          <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
};

export default Panel;
