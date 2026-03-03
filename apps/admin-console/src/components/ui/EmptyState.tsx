import React from "react";

type EmptyStateProps = {
  title: string;
  hint: string;
};

const EmptyState = ({ title, hint }: EmptyStateProps) => {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <strong>{title}</strong>
      <span>{hint}</span>
    </div>
  );
};

export default EmptyState;
