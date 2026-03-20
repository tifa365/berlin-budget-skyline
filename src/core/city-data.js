import { LAYOUT_CONFIG } from "../config.js";

export function buildCityModel(rawArticles) {
  const articles = rawArticles.map((article, index) => ({
    ...article,
    rank: index + 1,
  }));

  const random = createSeededRandom(LAYOUT_CONFIG.seed);
  const blockFootprintX =
    LAYOUT_CONFIG.blockSize * LAYOUT_CONFIG.lotWidth +
    (LAYOUT_CONFIG.blockSize - 1) * LAYOUT_CONFIG.alley;
  const blockFootprintZ =
    LAYOUT_CONFIG.blockSize * LAYOUT_CONFIG.lotDepth +
    (LAYOUT_CONFIG.blockSize - 1) * LAYOUT_CONFIG.alley;
  const blockSpanX = blockFootprintX + LAYOUT_CONFIG.street;
  const blockSpanZ = blockFootprintZ + LAYOUT_CONFIG.street;
  const parkSizeX = blockFootprintX * 2.45 + LAYOUT_CONFIG.street * 2;
  const parkSizeZ = blockFootprintZ * 2.45 + LAYOUT_CONFIG.street * 2;

  const blocks = [];
  const lots = [];
  const seenBlocks = new Set();
  const totalBlocks = Math.ceil(articles.length / (LAYOUT_CONFIG.blockSize ** 2));

  for (let index = 0; lots.length < articles.length && index < totalBlocks * 3; index += 1) {
    const [gx, gz] = spiral(index);
    if (Math.abs(gx) <= LAYOUT_CONFIG.parkRadius && Math.abs(gz) <= LAYOUT_CONFIG.parkRadius) {
      continue;
    }

    const [blockX, blockZ] = gridToWorld(gx, gz, blockSpanX, blockSpanZ);
    const blockKey = `${gx},${gz}`;
    if (!seenBlocks.has(blockKey)) {
      seenBlocks.add(blockKey);
      blocks.push({ gx, gz, x: blockX, z: blockZ });
    }

    for (let row = 0; row < LAYOUT_CONFIG.blockSize && lots.length < articles.length; row += 1) {
      for (let column = 0; column < LAYOUT_CONFIG.blockSize && lots.length < articles.length; column += 1) {
        const x =
          blockX +
          (column - (LAYOUT_CONFIG.blockSize - 1) / 2) *
            (LAYOUT_CONFIG.lotWidth + LAYOUT_CONFIG.alley);
        const z =
          blockZ +
          (row - (LAYOUT_CONFIG.blockSize - 1) / 2) *
            (LAYOUT_CONFIG.lotDepth + LAYOUT_CONFIG.alley);
        lots.push({ x, z });
      }
    }
  }

  const reserveCount = Math.min(LAYOUT_CONFIG.reserveTopCount, articles.length);
  const topArticles = articles.slice(0, reserveCount);
  const restArticles = articles.slice(reserveCount);
  shuffle(restArticles, random);

  const reservedLotIndexes = selectSpreadIndexes(
    Math.min(LAYOUT_CONFIG.centralPoolSize, lots.length),
    reserveCount,
    LAYOUT_CONFIG.reserveSpacing,
    random,
  );
  const reservedLotSet = new Set(reservedLotIndexes);
  const remainingLotIndexes = [];
  for (let index = 0; index < lots.length; index += 1) {
    if (!reservedLotSet.has(index)) {
      remainingLotIndexes.push(index);
    }
  }
  shuffle(remainingLotIndexes, random);

  const lotAssignments = new Array(lots.length);
  reservedLotIndexes.forEach((lotIndex, index) => {
    lotAssignments[lotIndex] = topArticles[index];
  });
  restArticles.forEach((article, index) => {
    lotAssignments[remainingLotIndexes[index]] = article;
  });

  const maxViews = Math.max(...articles.map((article) => article.sizeMetric ?? Math.abs(article.views)));
  const totalViews = articles.reduce((sum, article) => sum + article.views, 0);
  const buildings = lots.map((lot, index) =>
    createBuilding(index, lot, lotAssignments[index], maxViews),
  );

  return {
    articles,
    buildings,
    blocks,
    stats: {
      totalArticles: articles.length,
      totalViews,
      topArticle: articles[0],
    },
    layout: {
      blockFootprintX,
      blockFootprintZ,
      parkSizeX,
      parkSizeZ,
    },
  };
}

function createBuilding(index, lot, article, maxViews) {
  const relativeSize = (article.sizeMetric ?? Math.abs(article.views)) / maxViews;
  const intensity = Math.pow(relativeSize, 0.25);
  const height =
    LAYOUT_CONFIG.minHeight +
    intensity * (LAYOUT_CONFIG.maxHeight - LAYOUT_CONFIG.minHeight);
  const width = LAYOUT_CONFIG.lotWidth * (0.55 + intensity * 0.45);
  const depth = LAYOUT_CONFIG.lotDepth * (0.55 + intensity * 0.45);

  return {
    index,
    x: lot.x,
    z: lot.z,
    width,
    depth,
    height,
    floors: Math.max(3, Math.round(height / LAYOUT_CONFIG.floorHeight)),
    intensity,
    title: article.title,
    words: article.words,
    views: article.views,
    rank: article.rank,
    sizeMetric: article.sizeMetric ?? Math.abs(article.views),
    area: article.area || "",
    responsibility: article.responsibility || "",
    year: article.year || "",
    url: article.url || "",
    plan: article.plan || "",
    chapter: article.chapter || "",
    code: article.code || "",
    titleType: article.titleType || "A",
  };
}

function createSeededRandom(seed) {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = current;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

function spiral(index) {
  if (index === 0) {
    return [0, 0];
  }

  let x = 0;
  let y = 0;
  let dx = 1;
  let dy = 0;
  let stepLimit = 1;
  let steps = 0;
  let turns = 0;

  for (let cursor = 0; cursor < index; cursor += 1) {
    x += dx;
    y += dy;
    steps += 1;
    if (steps === stepLimit) {
      steps = 0;
      [dx, dy] = [-dy, dx];
      turns += 1;
      if (turns % 2 === 0) {
        stepLimit += 1;
      }
    }
  }

  return [x, y];
}

function gridToWorld(gx, gz, blockSpanX, blockSpanZ) {
  let x = gx * blockSpanX;
  let z = gz * blockSpanZ;

  if (gx > 0) {
    x += Math.floor(gx / LAYOUT_CONFIG.avenueEvery) * (LAYOUT_CONFIG.avenueWidth - LAYOUT_CONFIG.street);
  } else if (gx < 0) {
    x -= Math.floor(-gx / LAYOUT_CONFIG.avenueEvery) * (LAYOUT_CONFIG.avenueWidth - LAYOUT_CONFIG.street);
  }

  if (gz > 0) {
    z += Math.floor(gz / LAYOUT_CONFIG.avenueEvery) * (LAYOUT_CONFIG.avenueWidth - LAYOUT_CONFIG.street);
  } else if (gz < 0) {
    z -= Math.floor(-gz / LAYOUT_CONFIG.avenueEvery) * (LAYOUT_CONFIG.avenueWidth - LAYOUT_CONFIG.street);
  }

  return [x, z];
}

function selectSpreadIndexes(poolSize, count, spacing, random) {
  const selected = [];
  const seen = new Set();

  for (let cursor = 0; cursor < poolSize && selected.length < count; cursor += spacing) {
    const jitter = Math.floor(random() * 3) - 1;
    const candidate = clamp(cursor + jitter, 0, poolSize - 1);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      selected.push(candidate);
    }
  }

  for (let index = 0; index < poolSize && selected.length < count; index += 1) {
    if (!seen.has(index)) {
      seen.add(index);
      selected.push(index);
    }
  }

  return selected;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
