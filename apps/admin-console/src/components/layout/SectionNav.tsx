import React from "react";

export type NavItem = {
  id: string;
  label: string;
};

type SectionNavProps = {
  items: NavItem[];
  compact?: boolean;
  activeId?: string;
};

const SectionNav = ({ items, compact, activeId }: SectionNavProps) => {
  return (
    <nav className={compact ? "section-nav section-nav--compact" : "section-nav"} aria-label="Page sections">
      <h2 className="section-nav__title">Operator Workflow</h2>
      <ol>
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={activeId === item.id ? "is-active" : undefined}
              aria-current={activeId === item.id ? "location" : undefined}
            >
              <span>{index + 1}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default SectionNav;
