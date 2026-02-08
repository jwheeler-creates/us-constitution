import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} NormalizedEntry
 * @property {string} id
 * @property {"preamble"|"article"|"amendment"} part
 * @property {string} type
 * @property {number|null} article
 * @property {number|null} section
 * @property {number|null} clause
 * @property {number|null} subclause
 * @property {number|null} amendmentNumber
 * @property {boolean} isRepealed
 * @property {string} text
 * @property {string[]} searchTags
 * @property {number} position
 * @property {string} title
 * @property {string|null} ratifiedOn
 * @property {string|null} effectiveOn
 * @property {string|null} proposedOn
 * @property {string|null} repealedOn
 * @property {string} searchable
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const dataPath = path.join(rootDir, "constitution.json");
const indexPath = path.join(rootDir, "src", "index.html");
const generatedDir = path.join(rootDir, "src", "generated");
const prerenderPath = path.join(generatedDir, "constitution-prerender.html");
const searchIndexPath = path.join(generatedDir, "search-index.json");
const llmPath = path.join(rootDir, "llm.md");

const tocStart = "<!-- GENERATED_TOC_START -->";
const tocEnd = "<!-- GENERATED_TOC_END -->";
const contentStart = "<!-- GENERATED_CONTENT_START -->";
const contentEnd = "<!-- GENERATED_CONTENT_END -->";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function valueOrNull(value) {
  return typeof value === "number" ? value : null;
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getPart(entry) {
  if (entry.type === "preamble") {
    return "preamble";
  }
  if (entry.type === "amendment" || /^amend\d+-/.test(entry.id)) {
    return "amendment";
  }
  return "article";
}

function getAmendmentNumber(entry) {
  const match = /^amend(\d+)-/.exec(entry.id);
  return match ? Number(match[1]) : null;
}

function buildTitle(entry) {
  if (entry.part === "preamble") {
    return "Preamble";
  }

  const pieces = [];

  if (entry.part === "article") {
    pieces.push(`Article ${entry.article}`);
  } else {
    pieces.push(`Amendment ${entry.amendmentNumber}`);
  }

  if (entry.section !== null) {
    pieces.push(`Section ${entry.section}`);
  }
  if (entry.clause !== null) {
    pieces.push(`Clause ${entry.clause}`);
  }
  if (entry.subclause !== null) {
    pieces.push(`Subclause ${entry.subclause}`);
  }

  return pieces.join(", ");
}

function formatPartLabel(entry) {
  if (entry.part === "preamble") {
    return "Preamble";
  }
  if (entry.part === "article") {
    return "Article";
  }
  return "Amendment";
}

function buildDetailRows(entry) {
  /** @type {Array<[string, string]>} */
  const rows = [];
  rows.push(["Part", formatPartLabel(entry)]);

  if (entry.article !== null) {
    rows.push(["Article", String(entry.article)]);
  }
  if (entry.amendmentNumber !== null) {
    rows.push(["Amendment", String(entry.amendmentNumber)]);
  }
  if (entry.section !== null) {
    rows.push(["Section", String(entry.section)]);
  }
  if (entry.clause !== null) {
    rows.push(["Clause", String(entry.clause)]);
  }
  if (entry.subclause !== null) {
    rows.push(["Subclause", String(entry.subclause)]);
  }
  if (entry.searchTags.length > 0) {
    rows.push(["Search tags", entry.searchTags.join(", ")]);
  }
  if (entry.ratifiedOn) {
    rows.push(["Ratified", entry.ratifiedOn]);
  }
  if (entry.proposedOn) {
    rows.push(["Proposed", entry.proposedOn]);
  }
  if (entry.effectiveOn) {
    rows.push(["Effective", entry.effectiveOn]);
  }
  if (entry.repealedOn) {
    rows.push(["Repealed", entry.repealedOn]);
  }

  return rows;
}

function buildDetailsHtml(entry, entryAnchorId) {
  const rows = buildDetailRows(entry);
  const itemsHtml = rows
    .map(
      ([label, value]) =>
        `      <div class="entry-detail-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    )
    .join("\n");

  return [
    '  <details class="entry-details">',
    '    <summary class="entry-details-toggle" aria-label="Entry details">i</summary>',
    '    <dl class="entry-details-list">',
    `      <div class="entry-detail-row entry-detail-row-link"><dt>Link</dt><dd><button type="button" class="copy-anchor-button" data-anchor-id="${escapeHtml(entryAnchorId)}">Copy link</button> <a class="entry-anchor-link" href="#${escapeHtml(entryAnchorId)}">Open</a></dd></div>`,
    itemsHtml,
    "    </dl>",
    "  </details>"
  ].join("\n");
}

/**
 * @param {unknown} rawData
 * @returns {NormalizedEntry[]}
 */
function normalize(rawData) {
  if (!Array.isArray(rawData)) {
    throw new Error("constitution.json must be an array.");
  }

  return rawData
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        throw new Error("Encountered invalid record in constitution.json.");
      }

      const id = String(entry.id ?? "");
      const type = String(entry.type ?? "");
      const text = String(entry.text ?? "");
      const searchTags = Array.isArray(entry.searchTags)
        ? entry.searchTags.map((tag) => String(tag))
        : [];
      const position = Number(entry.position);

      if (!id || !type || !text || Number.isNaN(position)) {
        throw new Error(`Entry is missing required fields: ${JSON.stringify(entry)}`);
      }

      const part = getPart({ id, type });
      const article = valueOrNull(entry.article);
      const section = valueOrNull(entry.section);
      const clause = valueOrNull(entry.clause);
      const subclause = valueOrNull(entry.subclause);
      const amendmentNumber = getAmendmentNumber({ id });
      const ratifiedOn = stringOrNull(entry.ratifiedOn);
      const effectiveOn = stringOrNull(entry.effectiveOn);
      const proposedOn = stringOrNull(entry.proposedOn);
      const repealedOn = stringOrNull(entry.repealedOn);
      const isRepealed = entry.repealedOn !== null && entry.repealedOn !== undefined;

      const normalized = {
        id,
        part,
        type,
        article,
        section,
        clause,
        subclause,
        amendmentNumber,
        isRepealed,
        text,
        searchTags,
        position,
        title: "",
        ratifiedOn,
        effectiveOn,
        proposedOn,
        repealedOn,
        searchable: ""
      };

      normalized.title = buildTitle(normalized);
      normalized.searchable = [
        normalized.text,
        normalized.id,
        ...normalized.searchTags,
        normalized.title
      ]
        .join(" ")
        .toLowerCase();

      return normalized;
    })
    .sort((a, b) => a.position - b.position);
}

/**
 * @param {NormalizedEntry[]} entries
 */
function buildToc(entries) {
  const parts = [];
  const articleNumbers = new Set();
  const amendmentNumbers = new Set();
  let hasPreamble = false;

  for (const entry of entries) {
    if (entry.part === "preamble") {
      hasPreamble = true;
    }
    if (entry.part === "article" && entry.article !== null) {
      articleNumbers.add(entry.article);
    }
    if (entry.part === "amendment" && entry.amendmentNumber !== null) {
      amendmentNumbers.add(entry.amendmentNumber);
    }
  }

  if (hasPreamble) {
    parts.push(
      '<li><a href="#part-preamble">Preamble</a></li>'
    );
  }

  const sortedArticleNumbers = [...articleNumbers].sort((a, b) => a - b);
  const sortedAmendmentNumbers = [...amendmentNumbers].sort((a, b) => a - b);

  if (sortedArticleNumbers.length > 0) {
    parts.push('<li class="toc-group"><a href="#part-articles">Part: Articles</a></li>');
    for (const num of sortedArticleNumbers) {
      parts.push(
        `<li class="toc-subitem"><a href="#part-article-${num}">Article ${num}</a></li>`
      );
    }
  }

  if (sortedAmendmentNumbers.length > 0) {
    parts.push('<li class="toc-group"><a href="#part-amendments">Part: Amendments</a></li>');
    for (const num of sortedAmendmentNumbers) {
      parts.push(
        `<li class="toc-subitem"><a href="#part-amendment-${num}">Amendment ${num}</a></li>`
      );
    }
  }

  return `<ol class="toc-list">\n${parts.map((item) => `  ${item}`).join("\n")}\n</ol>`;
}

/**
 * @param {NormalizedEntry[]} entries
 */
function buildContent(entries) {
  const blocks = [];
  let hasPreambleHeading = false;
  let hasArticlePartHeading = false;
  let hasAmendmentPartHeading = false;
  let currentArticle = null;
  let currentAmendment = null;
  let blockOpen = false;

  function closePartBlock() {
    if (!blockOpen) {
      return;
    }
    blocks.push("</section>");
    blockOpen = false;
  }

  function openPartBlock(attrs, headingHtml) {
    closePartBlock();
    blocks.push(`<section class="part-block" ${attrs}>`);
    blocks.push(...headingHtml);
    blockOpen = true;
  }

  for (const entry of entries) {
    if (entry.part === "preamble" && !hasPreambleHeading) {
      hasPreambleHeading = true;
      openPartBlock(
        'data-part-block="preamble"',
        [
          '<section class="part-heading" id="part-preamble" data-part-heading="preamble">',
          "  <h2>Preamble</h2>",
          "</section>"
        ]
      );
    }

    if (entry.part === "article" && entry.article !== currentArticle) {
      if (!hasArticlePartHeading) {
        closePartBlock();
        hasArticlePartHeading = true;
        blocks.push(
          '<section class="major-part-heading" id="part-articles" data-major-heading="articles">',
          "  <h2>Part: Articles</h2>",
          "</section>"
        );
      }

      currentArticle = entry.article;
      openPartBlock(
        `data-part-block="article" data-part-block-number="${currentArticle}"`,
        [
          `<section class="part-heading" id="part-article-${currentArticle}" data-part-heading="article">`,
          `  <h2>Article ${currentArticle}</h2>`,
          "</section>"
        ]
      );
    }

    if (entry.part === "amendment" && entry.amendmentNumber !== currentAmendment) {
      if (!hasAmendmentPartHeading) {
        closePartBlock();
        hasAmendmentPartHeading = true;
        blocks.push(
          '<section class="major-part-heading" id="part-amendments" data-major-heading="amendments">',
          "  <h2>Part: Amendments</h2>",
          "</section>"
        );
      }

      currentAmendment = entry.amendmentNumber;
      openPartBlock(
        `data-part-block="amendment" data-part-block-number="${currentAmendment}"`,
        [
          `<section class="part-heading" id="part-amendment-${currentAmendment}" data-part-heading="amendment">`,
          `  <h2>Amendment ${currentAmendment}</h2>`,
          "</section>"
        ]
      );
    }

    const escapedId = escapeHtml(entry.id);
    const entryId = `entry-${escapedId}`;
    const articleValue = entry.article === null ? "" : String(entry.article);
    const amendmentValue =
      entry.amendmentNumber === null ? "" : String(entry.amendmentNumber);
    const repealedBadge = entry.isRepealed
      ? '<span class="repealed-badge">Repealed</span>'
      : "";
    const textHtml = escapeHtml(entry.text).replace(/\n/g, "<br>");
    const detailsHtml = buildDetailsHtml(entry, entryId);

    blocks.push(
      `<article class="entry" id="${entryId}" data-entry-id="${escapedId}" data-part="${entry.part}" data-article="${articleValue}" data-amendment="${amendmentValue}" data-repealed="${entry.isRepealed ? "true" : "false"}">`,
      '  <div class="entry-heading-row">',
      `    <h3 class="entry-title"><a href="#${entryId}">${escapeHtml(entry.title)}</a>${repealedBadge}</h3>`,
      detailsHtml,
      "  </div>",
      `  <p class="entry-text">${textHtml}</p>`,
      "</article>"
    );
  }

  closePartBlock();

  return blocks.join("\n");
}

function buildLlmHeading(entry) {
  if (entry.part === "preamble") {
    return "Preamble";
  }

  const pieces = [];
  if (entry.part === "article") {
    pieces.push(`Article ${entry.article}`);
  } else {
    pieces.push(`Amendment ${entry.amendmentNumber}`);
  }

  if (entry.section !== null) {
    pieces.push(`Section ${entry.section}`);
  }
  if (entry.part === "article" && entry.clause !== null) {
    pieces.push(`Clause ${entry.clause}`);
  }
  if (entry.subclause !== null) {
    pieces.push(`Subclause ${entry.subclause}`);
  }

  return pieces.join(", ");
}

/**
 * @param {NormalizedEntry[]} entries
 */
function buildLlmMarkdown(entries) {
  const lines = [
    "# Constitution of the United States",
    "",
    "Plain-text retrieval document for LLM use.",
    "Generated from constitution.json by scripts/build-content.mjs.",
    ""
  ];

  let hasArticlesHeader = false;
  let hasAmendmentsHeader = false;
  let currentArticle = null;
  let currentAmendment = null;

  for (const entry of entries) {
    if (entry.part === "preamble") {
      if (lines[lines.length - 1] !== "") {
        lines.push("");
      }
      lines.push("## Preamble", "");
    }

    if (entry.part === "article" && entry.article !== currentArticle) {
      if (!hasArticlesHeader) {
        hasArticlesHeader = true;
        lines.push("## Articles", "");
      }
      currentArticle = entry.article;
      lines.push(`### Article ${currentArticle}`, "");
    }

    if (entry.part === "amendment" && entry.amendmentNumber !== currentAmendment) {
      if (!hasAmendmentsHeader) {
        hasAmendmentsHeader = true;
        lines.push("## Amendments", "");
      }
      currentAmendment = entry.amendmentNumber;
      lines.push(`### Amendment ${currentAmendment}`, "");
    }

    lines.push(`#### ${buildLlmHeading(entry)} [${entry.id}]`);
    lines.push(entry.text);
    if (entry.isRepealed && entry.repealedOn) {
      lines.push(`[Repealed on ${entry.repealedOn}]`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function injectGenerated(sourceHtml, startMarker, endMarker, content) {
  const pattern = new RegExp(
    `${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`,
    "m"
  );
  if (!pattern.test(sourceHtml)) {
    throw new Error(`Missing marker pair: ${startMarker} / ${endMarker}`);
  }
  return sourceHtml.replace(pattern, `${startMarker}\n${content}\n${endMarker}`);
}

async function main() {
  const raw = await readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  const entries = normalize(data);

  const tocHtml = buildToc(entries);
  const contentHtml = buildContent(entries);

  await mkdir(generatedDir, { recursive: true });
  await writeFile(prerenderPath, contentHtml, "utf8");

  const searchIndex = entries.map((entry) => ({
    id: entry.id,
    part: entry.part,
    type: entry.type,
    article: entry.article,
    section: entry.section,
    clause: entry.clause,
    subclause: entry.subclause,
    amendmentNumber: entry.amendmentNumber,
    isRepealed: entry.isRepealed,
    searchable: entry.searchable
  }));
  await writeFile(searchIndexPath, `${JSON.stringify(searchIndex, null, 2)}\n`, "utf8");
  await writeFile(llmPath, buildLlmMarkdown(entries), "utf8");

  const sourceIndexHtml = await readFile(indexPath, "utf8");
  const withToc = injectGenerated(sourceIndexHtml, tocStart, tocEnd, tocHtml);
  const withContent = injectGenerated(withToc, contentStart, contentEnd, contentHtml);
  await writeFile(indexPath, withContent, "utf8");

  process.stdout.write(
    `Generated ${entries.length} entries into src/generated, updated src/index.html, and wrote llm.md.\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
