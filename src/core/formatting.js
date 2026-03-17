const viewFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const wordFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-US");

export function formatViews(value) {
  return viewFormatter.format(value);
}

export function formatWords(value) {
  return wordFormatter.format(value);
}

export function formatInteger(value) {
  return integerFormatter.format(value);
}

export function describeRank(rank) {
  if (rank === 1) {
    return "The single most-viewed article in the dataset.";
  }
  if (rank <= 10) {
    return "One of the 10 most-viewed articles in the dataset.";
  }
  if (rank <= 100) {
    return "A top-100 article by views.";
  }
  if (rank <= 1000) {
    return "A top-1,000 article by views.";
  }
  if (rank <= 10000) {
    return "Still inside the top 10,000 articles by views.";
  }
  return "Part of the 100,000-article skyline.";
}

export function buildArticleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
