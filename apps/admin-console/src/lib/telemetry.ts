export type UiEventName =
  | "health_check"
  | "authorize"
  | "replay"
  | "kill_switch_activate"
  | "kill_switch_restore"
  | "approval_request"
  | "approval_resolve"
  | "attest"
  | "attestation_verify"
  | "evidence_lookup"
  | "feedback_submit"
  | "onboarding_dismiss";

export type UiEvent = {
  name: UiEventName;
  timestamp: string;
  success: boolean;
  detail?: string;
};

const KEY = "sentinel-v2-ui-events";

function canUseStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const storage = window.localStorage;
  return typeof storage?.getItem === "function" && typeof storage?.setItem === "function";
}

export function trackUiEvent(event: Omit<UiEvent, "timestamp">): void {
  if (typeof window === "undefined") {
    return;
  }

  const entry: UiEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  const existing = readUiEvents();
  const updated = [...existing, entry].slice(-250);
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(updated));
    } catch {
      // noop
    }
  }

  window.dispatchEvent(new CustomEvent<UiEvent>("sentinel:ui-event", { detail: entry }));
}

export function readUiEvents(): UiEvent[] {
  if (!canUseStorage()) {
    return [];
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as UiEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearUiEvents(): void {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}
