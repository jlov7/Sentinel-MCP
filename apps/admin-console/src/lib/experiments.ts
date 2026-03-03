export type NavVariant = "compact" | "expanded";

const NAV_VARIANT_KEY = "sentinel-v2-nav-variant";

function canUseStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const storage = window.localStorage;
  return typeof storage?.getItem === "function" && typeof storage?.setItem === "function";
}

export function detectNavVariant(defaultVariant: NavVariant = "expanded"): NavVariant {
  if (typeof window === "undefined") {
    return defaultVariant;
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("nav");
  if (fromQuery === "compact" || fromQuery === "expanded") {
    if (canUseStorage()) {
      try {
        window.localStorage.setItem(NAV_VARIANT_KEY, fromQuery);
      } catch {
        // noop
      }
    }
    return fromQuery;
  }

  let stored: string | null = null;
  if (canUseStorage()) {
    try {
      stored = window.localStorage.getItem(NAV_VARIANT_KEY);
    } catch {
      stored = null;
    }
  }
  if (stored === "compact" || stored === "expanded") {
    return stored;
  }

  return defaultVariant;
}
