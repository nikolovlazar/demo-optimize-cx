"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Sentry from "@sentry/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type OptimizationMode =
  | "none"
  | "prefetch"
  | "preload"
  | "prerender";

type SpeculationSettingsContextValue = {
  optimizationMode: OptimizationMode;
  hasHydrated: boolean;
};

const SpeculationSettingsContext = createContext<
  SpeculationSettingsContextValue | undefined
>(undefined);

const STORAGE_KEY = "optimize-cx:optimization-mode";
const SCRIPT_ID = "optimize-cx-speculation-rules";
const PRELOAD_ATTRIBUTE = "data-optimize-cx-preload";
const SENTRY_OPTIMIZATION_TAG = "optimization_mode";
const PRODUCT_MATCHER = "/products/.*";
const CART_PATH = "/cart";

function isOptimizationMode(value: string | null): value is OptimizationMode {
  return (
    value === "none" ||
    value === "prefetch" ||
    value === "preload" ||
    value === "prerender"
  );
}

function normalizeInternalHref(href: string, origin: string) {
  if (!href) {
    return undefined;
  }

  if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(href)) {
    return undefined;
  }

  if (href.startsWith("#")) {
    return undefined;
  }

  try {
    if (/^https?:\/\//i.test(href)) {
      const url = new URL(href);
      if (url.origin !== origin) {
        return undefined;
      }
      return url.toString();
    }

    if (href.startsWith("//")) {
      const url = new URL(`${window.location.protocol}${href}`);
      if (url.origin !== origin) {
        return undefined;
      }
      return url.toString();
    }

    if (href.startsWith("/")) {
      return `${origin}${href}`;
    }

    return `${origin}/${href}`;
  } catch {
    return undefined;
  }
}

function collectInternalUrls() {
  if (typeof window === "undefined") {
    return [];
  }

  const origin = window.location.origin;
  const urls = new Set<string>();

  document
    .querySelectorAll<HTMLAnchorElement>("a[href]")
    .forEach((anchor) => {
      const normalized = normalizeInternalHref(
        anchor.getAttribute("href") ?? "",
        origin,
      );
      if (normalized) {
        urls.add(normalized);
      }
    });

  if (urls.size === 0) {
    return [];
  }

  return Array.from(urls);
}

function buildSpeculationRules(optimizationMode: OptimizationMode) {
  if (optimizationMode === "prefetch") {
    return {
      prefetch: [
        {
          source: "document",
          where: {
            href_matches: PRODUCT_MATCHER,
          },
          eagerness: "moderate",
        },
        {
          source: "list",
          urls: [CART_PATH],
        },
      ],
    };
  }

  if (optimizationMode === "prerender") {
    return {
      prerender: [
        {
          source: "document",
          where: {
            href_matches: PRODUCT_MATCHER,
          },
          eagerness: "immediate",
        },
        {
          source: "list",
          urls: [CART_PATH],
        },
      ],
    };
  }

  return null;
}

export function SpeculationProvider({ children }: { children: ReactNode }) {
  const [optimizationMode, setOptimizationMode] =
    useState<OptimizationMode>("none");
  const [hasHydrated, setHasHydrated] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const optimizationParamRaw = searchParams.get("optimization");
  const legacyOptimizedParam = searchParams.get("optimized");
  const optimizationParam =
    optimizationParamRaw ??
    (legacyOptimizedParam === "true"
      ? "prerender"
      : legacyOptimizedParam === "false"
        ? "none"
        : null);

  useEffect(() => {
    let nextMode: OptimizationMode = "none";
    let shouldPersist = false;

    if (isOptimizationMode(optimizationParam)) {
      nextMode = optimizationParam;
      shouldPersist = true;
    } else {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (isOptimizationMode(storedValue)) {
        nextMode = storedValue;
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync optimization preference after reading URL/storage
    setOptimizationMode(nextMode);

    if (shouldPersist) {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    }

    setHasHydrated(true);
  }, [optimizationParam]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    Sentry.setTag(SENTRY_OPTIMIZATION_TAG, optimizationMode);

    const existingScript = document.head.querySelector<HTMLScriptElement>(
      `#${SCRIPT_ID}`,
    );

    const rules = buildSpeculationRules(optimizationMode);

    if (!rules) {
      if (existingScript) {
        existingScript.remove();
      }
      return;
    }

    if (
      typeof HTMLScriptElement === "undefined" ||
      typeof HTMLScriptElement.supports !== "function" ||
      !HTMLScriptElement.supports("speculationrules")
    ) {
      if (existingScript) {
        existingScript.remove();
      }
      return;
    }

    const serializedRules = JSON.stringify(rules);

    if (existingScript) {
      if (existingScript.textContent !== serializedRules) {
        existingScript.textContent = serializedRules;
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "speculationrules";
    script.textContent = serializedRules;
    document.head.appendChild(script);
  }, [hasHydrated, optimizationMode]);

  useEffect(() => {
    const existingPreloads = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>(
        `link[${PRELOAD_ATTRIBUTE}]`,
      ),
    );

    existingPreloads.forEach((link) => {
      link.remove();
    });

    if (!hasHydrated || optimizationMode !== "preload") {
      return;
    }

    const urls = collectInternalUrls();

    if (urls.length === 0) {
      return;
    }

    const seen = new Set<string>();
    const currentOrigin = window.location.origin;

    urls.forEach((absoluteUrl) => {
      try {
        const parsed = new URL(absoluteUrl);
        if (parsed.origin !== currentOrigin) {
          return;
        }

        const relative = `${parsed.pathname}${parsed.search}`;
        if (seen.has(relative)) {
          return;
        }
        seen.add(relative);

        try {
          const maybePromise = router.prefetch(relative) as unknown;
          if (
            typeof maybePromise === "object" &&
            maybePromise !== null &&
            "catch" in (maybePromise as Record<string, unknown>) &&
            typeof (maybePromise as Promise<void>).catch === "function"
          ) {
            (maybePromise as Promise<void>).catch(() => {});
          }
        } catch {
          // Ignore prefetch failures; we'll still add the preload hint below.
        }

        const preloadLink = document.createElement("link");
        preloadLink.setAttribute(PRELOAD_ATTRIBUTE, "true");
        preloadLink.rel = "preload";
        preloadLink.as = "fetch";
        preloadLink.href = relative;
        preloadLink.type = "text/html";
        preloadLink.crossOrigin = "anonymous";
        preloadLink.setAttribute("fetchpriority", "high");
        document.head.appendChild(preloadLink);
      } catch {
        // Swallow parsing errors; non-URL hrefs are ignored.
      }
    });
  }, [hasHydrated, optimizationMode, pathname, router]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      if (isOptimizationMode(event.newValue)) {
        setOptimizationMode(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      optimizationMode,
      hasHydrated,
    }),
    [optimizationMode, hasHydrated],
  );

  return (
    <SpeculationSettingsContext.Provider value={value}>
      {children}
    </SpeculationSettingsContext.Provider>
  );
}

export function useSpeculationSettings() {
  const context = useContext(SpeculationSettingsContext);

  if (!context) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "useSpeculationSettings called outside SpeculationProvider; returning default disabled state.",
      );
    }

    const fallback: SpeculationSettingsContextValue = {
      optimizationMode: "none",
      hasHydrated: false,
    };

    return fallback;
  }

  return context;
}

export function usePrefetchPreference() {
  const { optimizationMode, hasHydrated } = useSpeculationSettings();
  if (!hasHydrated) {
    return false;
  }
  return optimizationMode === "prefetch" || optimizationMode === "preload" || optimizationMode === "prerender";
}
