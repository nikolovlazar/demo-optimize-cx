import { browser } from "k6/browser";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL ?? "https://demo-optimize-cx.vercel.app";
const CART_STORAGE_KEY = "cart-storage";
const OPTIMIZATION_MODES = ["none", "prefetch", "preload", "prerender"];
const BROWSER_HEADLESS =
  String(
    __ENV.K6_BROWSER_HEADLESS ??
      __ENV.BROWSER_HEADLESS ??
      __ENV.HEADLESS ??
      "true",
  )
    .toLowerCase()
    .trim() !== "false";
const VITALS_SETTLE_MS = Number(__ENV.WEB_VITALS_WAIT_MS ?? 1500);
const HOVER_DELAY_MS = Number(__ENV.HOVER_DELAY_MS ?? 300);
const PRODUCT_DWELL_MS = Number(__ENV.PRODUCT_DWELL_MS ?? 2500);
const VISIBLE_BROWSER_ARGS = [
  "--start-maximized",
  "--force-device-scale-factor=1",
  "--disable-backgrounding-occluded-windows",
  "--enable-gpu",
];

const FIRST_NAMES = [
  "Alex",
  "Taylor",
  "Jordan",
  "Morgan",
  "Riley",
  "Casey",
  "Jamie",
  "Avery",
];
const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Brown",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
];
const CITIES = [
  "San Francisco",
  "New York",
  "Chicago",
  "Austin",
  "Seattle",
  "Denver",
];

export const options = {
  scenarios: {
    prefetch_comparison: {
      executor: "constant-vus",
      exec: "userJourney",
      vus: Number(__ENV.VUS ?? 2),
      duration: __ENV.DURATION ?? "10m",
      options: {
        browser: {
          type: "chromium",
          headless: BROWSER_HEADLESS,
          args: BROWSER_HEADLESS ? [] : VISIBLE_BROWSER_ARGS,
        },
      },
    },
  },
};

export async function userJourney() {
  const runIndex = exec.scenario.iterationInTest ?? 0;
  const optimizationMode =
    OPTIMIZATION_MODES[runIndex % OPTIMIZATION_MODES.length];
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await primeOptimizationState(page, optimizationMode);
    const productUrl = await visitHomeAndPickProduct(page);
    const addedToCart = await viewProductAndMaybeAdd(page, productUrl);
    await viewCartThroughHeader(page);

    if (addedToCart) {
      await proceedToCheckout(page);
      await completeCheckout(page);
    }

    await clearCartState(page);
    await allowWebVitalsToSettle(page, "journey-end");
    await page.waitForTimeout(randomBetween(1_000, 3_000));
  } catch (error) {
    console.error(
      `VU ${__VU} (optimization=${optimizationMode}) failed`,
      error,
    );
    throw error;
  } finally {
    await page.close();
    await context.close();
  }
}

async function primeOptimizationState(page, optimizationMode) {
  const normalizedBase = BASE_URL.endsWith("/")
    ? BASE_URL.slice(0, -1)
    : BASE_URL;
  const homeUrl = `${normalizedBase}/?optimization=${optimizationMode}`;

  await page.goto(homeUrl);
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("body");

  await waitForText(page, "h1", "Featured Products");
  await simulateUserGesture(page, "home-load");
  await allowWebVitalsToSettle(page, "home-load");
}

async function visitHomeAndPickProduct(page) {
  const listLocator = page.locator('a[href^="/products/"]');
  await listLocator.first().waitFor({ timeout: 15_000 });

  const linkCount = await listLocator.count();
  if (linkCount === 0) {
    throw new Error("No products found on homepage");
  }

  const targetIndex = randomBetween(0, linkCount - 1);
  const chosenHref = await listLocator.nth(targetIndex).getAttribute("href");

  if (!chosenHref) {
    throw new Error("Selected product link has no href attribute");
  }

  const normalizedBase = BASE_URL.endsWith("/")
    ? BASE_URL.slice(0, -1)
    : BASE_URL;
  const absoluteHref = chosenHref.startsWith("http")
    ? chosenHref
    : `${normalizedBase}${chosenHref.startsWith("/") ? "" : "/"}${chosenHref}`;
  return absoluteHref;
}

async function viewProductAndMaybeAdd(page, productUrl) {
  const relativeHref = productUrl.startsWith(BASE_URL)
    ? productUrl.slice(BASE_URL.length)
    : productUrl;
  const normalizedHref = relativeHref.startsWith("/")
    ? relativeHref
    : `/${relativeHref}`;
  const linkLocator = page.locator(
    `a[href="${normalizedHref}"], a[href="${productUrl}"]`,
  );

  const linkCount = await linkLocator.count();
  if (linkCount === 0) {
    throw new Error(`Unable to find product link for ${productUrl}`);
  }

  const targetLink = linkLocator.first();
  const targetPath = normalizedHref.split("?")[0] || "/";

  await targetLink.hover();
  await page.waitForTimeout(HOVER_DELAY_MS);
  await targetLink.click();

  await waitForUrlPath(page, targetPath, 10_000);
  await page.waitForLoadState("networkidle");
  await waitForText(page, "button", "Add to Cart");
  await simulateUserGesture(page, "product-load");
  await allowWebVitalsToSettle(page, "product-load");

  const shouldAdd = Math.random() >= 0.4;
  let addedToCart = false;

  if (shouldAdd) {
    const added = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const targetButton = buttons.find((btn) =>
        btn.textContent?.includes("Add to Cart"),
      );
      if (targetButton instanceof HTMLButtonElement) {
        targetButton.click();
        return true;
      }
      return false;
    });

    if (!added) {
      console.warn(`VU ${__VU}: Add to Cart button not found`);
    } else {
      await page.waitForTimeout(500);
      addedToCart = true;
    }
  }

  if (PRODUCT_DWELL_MS > 0) {
    await page.waitForTimeout(PRODUCT_DWELL_MS);
  }

  return addedToCart;
}

async function viewCartThroughHeader(page) {
  const cartLink = page.locator('header a[href="/cart"]');
  await cartLink.first().waitFor({ timeout: 15_000 });
  await Promise.all([
    waitForUrlPath(page, "/cart", 10_000),
    cartLink.first().click(),
  ]);

  await page.waitForSelector("main", { timeout: 10_000 });
  await simulateUserGesture(page, "cart");
  await allowWebVitalsToSettle(page, "cart");
}

async function proceedToCheckout(page) {
  await waitForText(page, "button", "Proceed to Checkout");

  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((btn) =>
      (btn.textContent || "").toLowerCase().includes("proceed to checkout"),
    );
    if (target instanceof HTMLButtonElement) {
      target.click();
      return true;
    }
    return false;
  });

  if (!clicked) {
    throw new Error("Checkout button not available");
  }

  await waitForUrlPath(page, "/checkout", 10_000);
  await page.waitForSelector("form", { timeout: 10_000 });
  await simulateUserGesture(page, "checkout-init");
  await allowWebVitalsToSettle(page, "checkout-init");
}

async function completeCheckout(page) {
  await page.waitForSelector("form", { timeout: 10_000 });

  const person = {
    firstName: pickRandom(FIRST_NAMES),
    lastName: pickRandom(LAST_NAMES),
    email: `perf-${exec.scenario.iterationInTest}-${__VU}@example.com`,
    address: `${randomBetween(100, 999)} Market Street`,
    city: pickRandom(CITIES),
    zip: `${randomBetween(10000, 99999)}`,
    cardNumber: "4242 4242 4242 4242",
    expiry: "12/29",
    cvv: `${randomBetween(100, 999)}`,
  };

  await fillInput(page, "#firstName", person.firstName);
  await fillInput(page, "#lastName", person.lastName);
  await fillInput(page, "#email", person.email);
  await fillInput(page, "#address", person.address);
  await fillInput(page, "#city", person.city);
  await fillInput(page, "#zipCode", person.zip);
  await fillInput(page, "#cardNumber", person.cardNumber);
  await fillInput(page, "#expiryDate", person.expiry);
  await fillInput(page, "#cvv", person.cvv);

  await waitForText(page, "button", "Complete Order");

  const submitClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((btn) =>
      (btn.textContent || "").toLowerCase().includes("complete order"),
    );
    if (target instanceof HTMLButtonElement) {
      target.click();
      return true;
    }
    return false;
  });

  if (!submitClicked) {
    throw new Error("Submit button not available");
  }

  await waitForUrlPath(page, "/checkout/success", 10_000);
  await waitForText(page, "h1", "Order Successful");
  await simulateUserGesture(page, "order-success");
  await allowWebVitalsToSettle(page, "order-success");
}

async function fillInput(page, selector, value) {
  const field = page.locator(selector);
  await field.waitFor({ timeout: 5_000 });
  await field.fill(value);
}

async function clearCartState(page) {
  await page.evaluate(
    ([key]) => window.localStorage.removeItem(key),
    [CART_STORAGE_KEY],
  );
}

async function waitForText(page, selector, text, timeout = 10_000) {
  const normalizedText = text.toLowerCase();
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const found = await page.evaluate(
      ([sel, target]) => {
        const elements = Array.from(document.querySelectorAll(sel));
        return elements.some((el) =>
          (el.textContent || "").toLowerCase().includes(target),
        );
      },
      [selector, normalizedText],
    );

    if (found) {
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Timeout waiting for ${selector} containing "${text}"`);
}

async function waitForUrlPath(page, expectedPath, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const currentUrl = new URL(await page.url());
    if (currentUrl.pathname === expectedPath) {
      return;
    }
    await page.waitForTimeout(100);
  }
  const finalUrl = await page.url();
  throw new Error(
    `Navigation mismatch: expected ${expectedPath}, current ${finalUrl}`,
  );
}

async function simulateUserGesture(page, contextLabel) {
  try {
    await page.keyboard.press("Shift");
    await page.waitForTimeout(25);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(25);
    const viewport = page.viewportSize();
    if (viewport) {
      await page.mouse.move(viewport.width / 2, viewport.height - 10, {
        steps: 2,
      });
    } else {
      await page.mouse.move(400, 500, { steps: 2 });
    }
  } catch (error) {
    console.warn(
      `Synthetic interaction failed (${contextLabel ?? "unknown"})`,
      error,
    );
  }
}

async function allowWebVitalsToSettle(page, contextLabel) {
  if (!Number.isFinite(VITALS_SETTLE_MS) || VITALS_SETTLE_MS <= 0) {
    return;
  }
  try {
    await page.waitForTimeout(VITALS_SETTLE_MS);
  } catch (error) {
    console.warn(
      `Web Vitals settle wait failed (${contextLabel ?? "unknown"})`,
      error,
    );
  }
}

function pickRandom(list) {
  return list[randomBetween(0, list.length - 1)];
}

function randomBetween(min, max) {
  if (min === max) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
