import { formatInteger, formatViews } from "../core/formatting.js";

export function createSearch({ input, results, items, onSelect, limit }) {
  const indexedItems = items
    .map((item) => ({
      ...item,
      lowerTitle: item.title.toLowerCase(),
    }))
    .sort((left, right) => left.rank - right.rank);

  let currentMatches = [];

  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", handleDocumentClick);

  function handleInput() {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      close();
      return;
    }

    currentMatches = [];
    for (const item of indexedItems) {
      if (item.lowerTitle.includes(query)) {
        currentMatches.push(item);
      }
      if (currentMatches.length >= limit) {
        break;
      }
    }

    render(currentMatches);
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      close();
      input.blur();
      return;
    }

    if (event.key === "Enter" && currentMatches[0]) {
      event.preventDefault();
      select(currentMatches[0]);
    }
  }

  function handleDocumentClick(event) {
    if (results.contains(event.target) || event.target === input) {
      return;
    }
    close();
  }

  function render(matches) {
    results.replaceChildren();
    if (!matches.length) {
      close();
      return;
    }

    matches.forEach((match) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.addEventListener("click", () => select(match));

      const title = document.createElement("span");
      title.className = "search-result__title";
      title.textContent = match.title;

      const meta = document.createElement("span");
      meta.className = "search-result__meta";
      meta.textContent = `${formatViews(match.views)} views • #${formatInteger(match.rank)}`;

      button.append(title, meta);
      results.appendChild(button);
    });

    results.classList.add("is-open");
  }

  function select(match) {
    input.value = match.title;
    close();
    onSelect(match.index);
  }

  function close() {
    results.classList.remove("is-open");
    results.replaceChildren();
    currentMatches = [];
  }

  return {
    setValue(value) {
      input.value = value;
    },
    clear() {
      input.value = "";
      close();
    },
  };
}
