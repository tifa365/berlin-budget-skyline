const amountCompactFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const amountFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("de-DE");

export function formatAmount(value, { compact = false } = {}) {
  return compact ? amountCompactFormatter.format(value) : amountFormatter.format(value);
}

// Compatibility export for any stale cached module graph that still asks for
// the old wiki-oriented helper name.
export function formatViews(value, options = {}) {
  return formatAmount(value, options);
}

export function formatInteger(value) {
  return integerFormatter.format(value);
}

export function describeRank(rank) {
  if (rank === 1) {
    return "The largest single budget item in this local dataset.";
  }
  if (rank <= 10) {
    return "One of the 10 largest budget items in this dataset.";
  }
  if (rank <= 100) {
    return "One of the larger Berlin budget items shown here.";
  }
  return "Part of the Berlin budget skyline.";
}
