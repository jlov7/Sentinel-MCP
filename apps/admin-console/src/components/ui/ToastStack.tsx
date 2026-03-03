import React from "react";

import { ToastNotice } from "../../lib/useMissionControl";

type ToastStackProps = {
  toasts: ToastNotice[];
  onDismiss: (id: number) => void;
};

const ToastStack = ({ toasts, onDismiss }: ToastStackProps) => {
  return (
    <section className="toast-stack" aria-live="polite" aria-label="Action notifications">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast toast--${toast.tone}`}>
          <div>
            <strong>{toast.title}</strong>
            {toast.detail ? <p>{toast.detail}</p> : null}
            {toast.nextStep ? <span>Next: {toast.nextStep}</span> : null}
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            Dismiss
          </button>
        </article>
      ))}
    </section>
  );
};

export default ToastStack;
