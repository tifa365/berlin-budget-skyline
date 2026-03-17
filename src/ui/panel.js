import {
  buildArticleUrl,
  describeRank,
  formatInteger,
  formatViews,
  formatWords,
} from "../core/formatting.js";

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
    views.textContent = formatViews(building.views);
    words.textContent = formatWords(building.words);
    floors.textContent = formatInteger(building.floors);
    link.href = buildArticleUrl(building.title);

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
      metaLine.textContent = `${formatViews(neighbor.views)} views • #${formatInteger(neighbor.rank)}`;

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
  };
}
