import { browser } from "k6/browser";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL ?? "http://localhost:3000";
const CART_STORAGE_KEY = "cart-storage";
const OPTIMIZATION_MODES = ["none", "prefetch", "preload", "prerender"];

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
      vus: Number(__ENV.VUS ?? 4),
      duration: __ENV.DURATION ?? "15m",
      options: {
        browser: {
          type: "chromium",
          headless: true,
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
    await visitCart(page);

    if (addedToCart) {
      await proceedToCheckout(page);
      await completeCheckout(page);
    }

    await clearCartState(page);
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
}

async function visitHomeAndPickProduct(page) {
  const productLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href^="/products/"]')).map(
      (anchor) => anchor.href.toString(),
    );
  });

  if (productLinks.length === 0) {
    throw new Error("No products found on homepage");
  }

  const target = productLinks[randomBetween(0, productLinks.length - 1)];
  return target;
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
  await page.waitForTimeout(300);
  await targetLink.click();

  const deadline = Date.now() + 10_000;
  let navigated = false;

  while (Date.now() < deadline) {
    const currentUrl = await page.url();
    if (currentUrl.includes(targetPath)) {
      navigated = true;
      break;
    }
    await page.waitForTimeout(100);
  }

  if (!navigated) {
    const finalUrl = await page.url();
    throw new Error(
      `Navigation mismatch: expected to include ${targetPath}, got ${finalUrl}`,
    );
  }

  await page.waitForLoadState("networkidle");
  await waitForText(page, "button", "Add to Cart");

  const shouldAdd = Math.random() >= 0.4;

  if (!shouldAdd) {
    return false;
  }

  const added = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const targetButton = buttons.find((btn) =>
      btn.textContent?.includes("Add to Cart"),
    );
    if (targetButton) {
      targetButton.click();
      return true;
    }
    return false;
  });

  if (!added) {
    console.warn(`VU ${__VU}: Add to Cart button not found`);
    return false;
  }

  await page.waitForTimeout(500);
  return true;
}

async function visitCart(page) {
  await page.goto(`${BASE_URL}/cart`);
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("main", { timeout: 10_000 });
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

  await page.waitForNavigation({ waitUntil: "load", timeout: 10_000 });
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

  await page.waitForNavigation({ waitUntil: "load", timeout: 10_000 });
  await waitForText(page, "h1", "Order Successful");
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

function pickRandom(list) {
  return list[randomBetween(0, list.length - 1)];
}

function randomBetween(min, max) {
  if (min === max) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
