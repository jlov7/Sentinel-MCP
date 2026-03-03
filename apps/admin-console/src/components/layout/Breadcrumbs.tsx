import React from "react";

type BreadcrumbsProps = {
  activeLabel: string;
};

const Breadcrumbs = ({ activeLabel }: BreadcrumbsProps) => {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <a href="#top">Mission Control</a>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <span aria-current="page">{activeLabel}</span>
        </li>
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
