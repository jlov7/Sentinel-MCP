import React from "react";

type MetricStripProps = {
  metrics: Array<{ label: string; value: string }>;
};

const MetricStrip = ({ metrics }: MetricStripProps) => {
  return (
    <section className="metric-strip" aria-label="Mission metrics">
      {metrics.map((metric) => (
        <article key={metric.label} className="metric-strip__item">
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </section>
  );
};

export default MetricStrip;
