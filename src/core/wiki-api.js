const WIKI_HOST = "https://de.wikipedia.org";
const SUMMARY_ENDPOINT = `${WIKI_HOST}/api/rest_v1/page/summary`;
const SEXUAL_IMAGE_KEYWORDS = [
  "klitoris",
  "penis",
  "vagina",
  "vulva",
  "geschlechtsverkehr",
  "vaginalverkehr",
  "oralverkehr",
  "analverkehr",
  "masturb",
  "porn",
  "porno",
  "xnxx",
  "xhamster",
  "pornhub",
  "genital",
  "sexualitat",
  "sexualitat",
  "sexual",
  "erotik",
  "erotisch",
  "sex",
];
const DISTURBING_IMAGE_KEYWORDS = [
  "mord",
  "morder",
  "killer",
  "serial",
  "vergewalt",
  "rape",
  "suizid",
  "suicide",
  "leiche",
  "corpse",
  "cadaver",
  "necroph",
  "hinrichtung",
  "execution",
  "beheading",
  "massaker",
  "massacre",
  "folter",
  "torture",
  "gore",
  "verstummel",
  "mutilat",
  "obduktion",
  "autopsy",
  "dissection",
  "sexual assault",
  "konzentrationslager",
  "kz",
];

const summaryCache = new Map();

export function buildArticleUrl(title) {
  return `${WIKI_HOST}/wiki/${encodeURIComponent(normalizeTitle(title))}`;
}

export async function fetchArticleSummary(title, { signal } = {}) {
  const normalizedTitle = normalizeTitle(title);
  const cachedSummary = summaryCache.get(normalizedTitle);
  if (cachedSummary) {
    return cachedSummary;
  }

  const request = fetch(
    `${SUMMARY_ENDPOINT}/${encodeURIComponent(normalizedTitle)}`,
    {
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  ).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Wikipedia summary request failed with ${response.status}`);
    }

    const data = await response.json();
    const title = data.title || denormalizeTitle(normalizedTitle);
    const description = data.description || "";
    const extract = data.extract || "";
    const imageUrl = data.thumbnail?.source || data.originalimage?.source || "";
    const imageMode = shouldRedactImage({ title, description, extract })
      ? "redacted"
      : imageUrl
        ? "live"
        : "none";

    return {
      title,
      description,
      extract,
      imageUrl: imageMode === "live" ? imageUrl : "",
      imageMode,
      url:
        data.content_urls?.desktop?.page ||
        data.content_urls?.mobile?.page ||
        buildArticleUrl(title),
    };
  });

  summaryCache.set(normalizedTitle, request);

  try {
    const summary = await request;
    summaryCache.set(normalizedTitle, summary);
    return summary;
  } catch (error) {
    summaryCache.delete(normalizedTitle);
    throw error;
  }
}

function normalizeTitle(title) {
  return String(title || "").trim().replace(/\s+/g, "_");
}

function denormalizeTitle(title) {
  return title.replace(/_/g, " ");
}

function shouldRedactImage(summary) {
  const normalized = normalizeSensitiveText(
    `${summary.title} ${summary.description} ${summary.extract}`,
  );
  return matchesKeyword(normalized, SEXUAL_IMAGE_KEYWORDS) ||
    matchesKeyword(normalized, DISTURBING_IMAGE_KEYWORDS);
}

function normalizeSensitiveText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}
