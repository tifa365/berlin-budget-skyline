import { formatAmount } from "../core/formatting.js";

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
  let visible = false;

  hideShell();
  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", handleDocumentClick);
  closeButton?.addEventListener("click", hideSearch);
  closeButton?.addEventListener("keydown", handleCloseButtonKeydown);
  window.addEventListener("keydown", handleGlobalKeydown);

  function handleGlobalKeydown(event) {
    const isSlash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;
    const isCtrlF = event.key === "f" && (event.ctrlKey || event.metaKey) && !event.altKey;
    const isCtrlX = event.key === "x" && (event.ctrlKey || event.metaKey) && !event.altKey;
    if (isCtrlX && visible) {
      event.preventDefault();
      hideSearch();
      return;
    }
    if (isSlash || isCtrlF) {
      const activeElement = document.activeElement;
      const tag = activeElement?.tagName;
      const isEditingField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        activeElement?.isContentEditable;
      if (isEditingField) {
        if (activeElement === input && isSlash) {
          event.preventDefault();
          hideSearch();
        }
        return;
      }
      event.preventDefault();
      if (visible) {
        hideSearch();
      } else {
        showShell();
        input.focus();
      }
    }
  }

  function handleInput() {
    if (!visible) {
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
    if (!visible) {
      return;
    }
    if (event.code === "Space") {
      event.stopPropagation();
      return;
    }
    if (event.key === "Escape") {
      hideSearch();
      return;
    }

    if (event.key === "Enter" && currentMatches[0]) {
      event.preventDefault();
      select(currentMatches[0]);
    }
  }

  function handleDocumentClick(event) {
    if (!visible) {
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

  function hideSearch(event) {
    event?.preventDefault();
    event?.stopPropagation();
    close();
    input.blur();
    document.body.focus();
    hideShell();
  }

  function handleCloseButtonKeydown(event) {
    if (event.key === "Enter" || event.key === " ") {
      hideSearch(event);
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

  return {
    setValue(value) {
      input.value = value;
    },
    clear() {
      input.value = "";
      close();
    },
  };

  function showShell() {
    if (!shell) {
      return;
    }
    visible = true;
    shell.classList.remove("is-hidden");
    shell.removeAttribute("aria-hidden");
  }

  function hideShell() {
    if (!shell) {
      return;
    }
    visible = false;
    shell.classList.add("is-hidden");
    shell.setAttribute("aria-hidden", "true");
  }
}
