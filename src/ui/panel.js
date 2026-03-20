import {
  describeRank,
  formatAmount,
  formatInteger,
} from "../core/formatting.js";
import { buildBudgetItemUrl } from "../core/budget-api.js";

const REDACTED_PREVIEW_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 192'%3E%3Crect width='512' height='192' fill='%23000000'/%3E%3C/svg%3E";

export function createInspector(elements, handlers) {
  const {
    panel,
    closeButton,
    title,
    tagline,
    rank,
    views,
    words,
    floors,
    link,
    preview,
    image,
    summaryState,
    description,
    extract,
    neighborList,
  } = elements;

  closeButton.addEventListener("click", () => {
    hide();
    handlers.onClose();
  });

  function show(building, neighbors) {
    title.textContent = building.title;
    tagline.textContent = describeRank(building.rank);
    rank.textContent = `#${formatInteger(building.rank)}`;
    views.textContent = formatAmount(building.views);
    words.textContent = `${building.code} • ${building.year}`;
    floors.textContent = formatInteger(building.floors);
    link.href = building.url || buildBudgetItemUrl();
    resetArticlePreview("Loading Berlin budget item details...");

    neighborList.replaceChildren();
    neighbors.forEach((neighbor) => {
      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => handlers.onNeighborSelect(neighbor.index));

      const titleLine = document.createElement("span");
      titleLine.className = "neighbor-list__title";
      titleLine.textContent = neighbor.title;

      const metaLine = document.createElement("span");
      metaLine.className = "neighbor-list__meta";
      metaLine.textContent = `${neighbor.code} • ${neighbor.year} • ${formatAmount(neighbor.views, { compact: true })}`;

      button.append(titleLine, metaLine);
      neighborList.appendChild(button);
    });

    panel.classList.add("is-open");
  }

  function hide() {
    panel.classList.remove("is-open");
  }

  return {
    show,
    hide,
    applyArticlePreview(summary) {
      title.textContent = summary.title || title.textContent;
      link.href = summary.url || buildBudgetItemUrl();

      if (summary.imageMode === "redacted") {
        preview.hidden = false;
        image.src = REDACTED_PREVIEW_SRC;
        image.alt = "Preview hidden";
      } else if (summary.imageUrl) {
        preview.hidden = false;
        image.src = summary.imageUrl;
        image.alt = `Preview image for ${summary.title || title.textContent}`;
      } else {
        clearPreviewImage();
      }

      if (summary.description) {
        description.hidden = false;
        description.textContent = summary.description;
      } else {
        description.hidden = true;
        description.textContent = "";
      }

      if (summary.extract) {
        extract.hidden = false;
        extract.textContent = summary.extract;
        summaryState.hidden = true;
        summaryState.textContent = "";
      } else {
        extract.hidden = true;
        extract.textContent = "";
        summaryState.hidden = false;
        summaryState.textContent = "No additional budget summary is available for this item.";
      }
    },
    showArticlePreviewError() {
      clearPreviewImage();
      description.hidden = true;
      description.textContent = "";
      extract.hidden = true;
      extract.textContent = "";
      summaryState.hidden = false;
      summaryState.textContent = "Budget details are unavailable right now.";
    },
  };

  function resetArticlePreview(message) {
    clearPreviewImage();
    description.hidden = true;
    description.textContent = "";
    extract.hidden = true;
    extract.textContent = "";
    summaryState.hidden = false;
    summaryState.textContent = message;
  }

  function clearPreviewImage() {
    preview.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
  }
}
