const BUDGET_HOST = "https://haushaltsdaten.odis-berlin.de";

export function buildBudgetItemUrl() {
  return `${BUDGET_HOST}/search`;
}

export async function fetchBudgetSummary(item, { signal } = {}) {
  if (signal?.aborted) {
    throw createAbortError();
  }

  return {
    title: item.title,
    description: `${describeType(item.titleType)} ${item.code} • ${item.year} • ${item.responsibility}`,
    extract:
      `${item.chapter}. ${item.area}. ${item.plan}. ` +
      `Veranschlagt sind ${formatBudgetSentence(item.views)} fuer diesen Posten im Berliner Doppelhaushalt ${item.year}.`,
    imageUrl: "",
    imageMode: "none",
    url: item.url || buildBudgetItemUrl(),
  };
}

function formatBudgetSentence(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function describeType(value) {
  return value === "E" ? "Einnahmetitel" : "Ausgabetitel";
}

function createAbortError() {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}
