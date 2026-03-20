import { formatAmount, formatInteger } from "../core/formatting.js";

export function createSearch({
  shell,
  input,
  results,
  closeButton,
  items,
  onSelect,
  limit,
}) {
  const indexedItems = items
    .map((item) => ({
      ...item,
      lowerTitle: item.title.toLowerCase(),
    }))
    .sort((left, right) => left.rank - right.rank);

  let currentMatches = [];
  let dismissed = false;

  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", handleDocumentClick);
  closeButton?.addEventListener("click", dismiss);
  closeButton?.addEventListener("keydown", handleCloseButtonKeydown);

  function handleInput() {
    if (dismissed) {
      return;
    }
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
    if (dismissed) {
      return;
    }
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
    if (dismissed) {
      return;
    }
    if (
      results.contains(event.target) ||
      event.target === input ||
      shell?.contains(event.target)
    ) {
      return;
    }
    close();
  }

  function dismiss(event) {
    if (dismissed) {
      return;
    }
    event?.preventDefault();
    event?.stopPropagation();
    close();
    input.blur();
    dismissed = true;
    teardown();
    hideShell();
  }

  function handleCloseButtonKeydown(event) {
    if (event.key === "Enter" || event.key === " ") {
      dismiss(event);
    }
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
      meta.textContent = `${match.code} • ${match.year} • ${formatAmount(match.views, { compact: true })}`;

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

  function teardown() {
    input.removeEventListener("input", handleInput);
    input.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("click", handleDocumentClick);
    closeButton?.removeEventListener("click", dismiss);
    closeButton?.removeEventListener("keydown", handleCloseButtonKeydown);
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

  function hideShell() {
    if (!shell) {
      return;
    }
    shell.classList.add("is-hidden");
    shell.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      shell.remove();
    }, 220);
  }
}
