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
import { useSearchParams } from "next/navigation";

export type OptimizationMode = "none" | "prefetch" | "prerender";

type SpeculationSettingsContextValue = {
  optimizationMode: OptimizationMode;
  hasHydrated: boolean;
};

const SpeculationSettingsContext = createContext<
  SpeculationSettingsContextValue | undefined
>(undefined);

const STORAGE_KEY = "optimize-cx:optimization-mode";
const SCRIPT_ID = "optimize-cx-speculation-rules";
const SENTRY_OPTIMIZATION_TAG = "optimization_mode";
const PRODUCT_MATCHER = "/products/.*";
const CART_PATH = "/cart";

function isOptimizationMode(value: string | null): value is OptimizationMode {
  return (
    value === "none" ||
    value === "prefetch" ||
    value === "prerender"
  );
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
  return optimizationMode === "prefetch" || optimizationMode === "prerender";
}
