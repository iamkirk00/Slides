import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const slidesDir = path.join(rootDir, 'slides');
const distDir = path.join(rootDir, 'dist');
const distSlidesDir = path.join(distDir, 'slides');

const escapeHtml = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });

const parseValue = (rawValue) => {
  const value = rawValue.trim();
  if (!value) {
    return '';
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner
      .split(',')
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
};

const extractFrontmatterAndBody = (content) => {
  const normalized = content.replaceAll('\r\n', '\n');
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, body: normalized };
  }

  const lines = normalized.split('\n');
  if (lines[0].trim() !== '---') {
    return { frontmatter: {}, body: normalized };
  }

  const frontmatterLines = [];
  let closingLine = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      closingLine = i;
      break;
    }
    frontmatterLines.push(lines[i]);
  }

  if (closingLine === -1) {
    return { frontmatter: {}, body: normalized };
  }

  const frontmatter = {};
  for (const line of frontmatterLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    frontmatter[key] = parseValue(rawValue);
  }

  return {
    frontmatter,
    body: lines.slice(closingLine + 1).join('\n'),
  };
};

const findFirstHeading = (body, fallbackTitle) => {
  const match = body.match(/^#\s+(.+)$/m);
  if (!match) {
    return fallbackTitle;
  }
  return match[1].trim() || fallbackTitle;
};

const inferDescription = (body) => {
  const lines = body.split('\n').map((line) => line.trim());
  for (const line of lines) {
    if (!line || line === '---') {
      continue;
    }
    if (line.startsWith('#') || line.startsWith('```')) {
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      continue;
    }
    return line;
  }
  return 'Open this deck to view the full presentation.';
};

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const extractSlideSections = (body) => {
  const lines = body.replaceAll('\r\n', '\n').split('\n');
  const sections = [];
  let buffer = [];

  for (const line of lines) {
    if (line.trim() === '---') {
      sections.push(buffer.join('\n'));
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  sections.push(buffer.join('\n'));
  return sections.filter((section) => section.trim().length > 0);
};

const normalizeHeadingText = (text) =>
  text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();

const pickSlideLabel = (section, index) => {
  const lines = section.split('\n').map((line) => line.trim());
  const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
  if (heading) {
    const normalized = normalizeHeadingText(heading.replace(/^#{1,6}\s+/, ''));
    if (normalized) {
      return normalized;
    }
  }

  const firstText = lines.find((line) => {
    if (!line) {
      return false;
    }
    if (line === '---' || line.startsWith('```')) {
      return false;
    }
    return true;
  });
  if (firstText) {
    const normalized = normalizeHeadingText(firstText);
    if (normalized) {
      return normalized;
    }
  }

  return `Slide ${index + 1}`;
};

const formatDate = (dateValue) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(dateValue);

const readDeckMetadata = async (markdownPath, fallbackTitle) => {
  const content = await fs.readFile(markdownPath, 'utf8');
  const { frontmatter, body } = extractFrontmatterAndBody(content);

  const title =
    typeof frontmatter.title === 'string' && frontmatter.title.trim()
      ? frontmatter.title.trim()
      : findFirstHeading(body, fallbackTitle);
  const description =
    typeof frontmatter.description === 'string' && frontmatter.description.trim()
      ? frontmatter.description.trim()
      : inferDescription(body);
  const author =
    typeof frontmatter.author === 'string' && frontmatter.author.trim()
      ? frontmatter.author.trim()
      : '';
  const tags = ensureArray(frontmatter.tags).slice(0, 5);
  const slideItems = extractSlideSections(body).map((section, index) => ({
    no: index + 1,
    label: pickSlideLabel(section, index),
  }));

  return {
    title,
    description,
    author,
    tags,
    slides: slideItems.length,
    slideItems,
  };
};

const buildLandingPage = (decks) => {
  const totalSlides = decks.reduce((sum, deck) => sum + deck.slides, 0);
  const updatedAt = formatDate(new Date());

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Slidev Deck Hub</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at 15% 15%, #1d4ed8 0%, transparent 36%),
          radial-gradient(circle at 85% 20%, #7c3aed 0%, transparent 32%),
          #020617;
        color: #e2e8f0;
      }
      main {
        max-width: 1040px;
        margin: 0 auto;
        padding: 2.5rem 1.25rem 4rem;
      }
      .hero {
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 1rem;
        background: rgba(15, 23, 42, 0.78);
        backdrop-filter: blur(3px);
        padding: 1.5rem;
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: clamp(1.8rem, 2.5vw, 2.7rem);
      }
      p {
        margin: 0;
        color: #bfdbfe;
        line-height: 1.5;
      }
      .hero-meta {
        margin-top: 1rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }
      .pill {
        font-size: 0.85rem;
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 999px;
        padding: 0.28rem 0.65rem;
        background: rgba(15, 23, 42, 0.55);
      }
      .grid {
        list-style: none;
        padding: 0;
        margin: 1.5rem 0 0;
        display: grid;
        gap: 1.1rem;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }
      .card {
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 0.95rem;
        background: rgba(15, 23, 42, 0.82);
        transition: transform 140ms ease, border-color 140ms ease;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .card:hover {
        transform: translateY(-2px);
        border-color: rgba(191, 219, 254, 0.55);
      }
      .card-content {
        padding: 1.1rem;
      }
      .card-title {
        display: block;
        font-weight: 700;
        font-size: 1.08rem;
        margin-bottom: 0.5rem;
      }
      .card-description {
        display: block;
        color: #cbd5e1;
        line-height: 1.45;
        margin-bottom: 0.9rem;
        min-height: 2.9em;
      }
      .card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        color: #93c5fd;
        font-size: 0.83rem;
      }
      .deck-actions {
        margin-top: 0.9rem;
        display: flex;
        gap: 0.55rem;
      }
      .deck-link {
        display: inline-block;
        text-decoration: none;
        color: #0f172a;
        background: linear-gradient(135deg, #bfdbfe, #93c5fd);
        border-radius: 0.5rem;
        font-weight: 600;
        font-size: 0.82rem;
        padding: 0.4rem 0.65rem;
      }
      .deck-link.secondary {
        color: #dbeafe;
        background: rgba(30, 41, 59, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.35);
      }
      .slide-nav {
        border-top: 1px solid rgba(148, 163, 184, 0.25);
        padding: 0.9rem 1.1rem 1rem;
      }
      .slide-nav-title {
        font-size: 0.78rem;
        color: #94a3b8;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 0.45rem;
      }
      .slide-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.35rem;
      }
      .slide-link {
        text-decoration: none;
        color: #dbeafe;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid rgba(148, 163, 184, 0.26);
        border-radius: 0.45rem;
        padding: 0.36rem 0.42rem;
        background: rgba(30, 41, 59, 0.6);
      }
      .slide-link:hover {
        border-color: rgba(191, 219, 254, 0.65);
        background: rgba(37, 99, 235, 0.24);
      }
      .slide-no {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.45rem;
        height: 1.45rem;
        border-radius: 0.35rem;
        font-size: 0.74rem;
        font-weight: 700;
        color: #0f172a;
        background: linear-gradient(135deg, #bfdbfe, #93c5fd);
      }
      .slide-label {
        font-size: 0.86rem;
        line-height: 1.3;
      }
      .tag-list {
        margin-top: 0.85rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .tag {
        font-size: 0.75rem;
        color: #dbeafe;
        background: rgba(30, 41, 59, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 0.45rem;
        padding: 0.2rem 0.45rem;
      }
      .empty {
        margin-top: 1.5rem;
        padding: 1rem 1.1rem;
        border-radius: 0.95rem;
        border: 1px dashed rgba(148, 163, 184, 0.65);
        color: #cbd5e1;
      }
      code {
        background: #1e293b;
        padding: 0.2rem 0.4rem;
        border-radius: 0.35rem;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>Slide Deck Hub</h1>
        <p>
          Browse your published decks and jump directly into any slide.
          Use this as your presentation navigation page.
        </p>
        <div class="hero-meta">
          <span class="pill">${decks.length} deck${decks.length === 1 ? '' : 's'}</span>
          <span class="pill">${totalSlides} total slide${totalSlides === 1 ? '' : 's'}</span>
          <span class="pill">Updated ${updatedAt}</span>
        </div>
      </section>
      ${
        decks.length === 0
          ? `<section class="empty">No decks published yet.</section>`
          : `<ul class="grid">
${decks
  .map(
    (deck) => `          <li class="card">
            <div class="card-content">
              <span class="card-title">${escapeHtml(deck.title)}</span>
              <span class="card-description">${escapeHtml(deck.description)}</span>
              <span class="card-meta">
                <span>${deck.slides} slide${deck.slides === 1 ? '' : 's'}</span>
                <span>Updated ${escapeHtml(deck.updatedAt)}</span>
                ${deck.author ? `<span>Author ${escapeHtml(deck.author)}</span>` : ''}
              </span>
              <span class="deck-actions">
                <a class="deck-link" href="${deck.startUrl}">Start presentation</a>
                <a class="deck-link secondary" href="${deck.url}">Deck home</a>
              </span>
              ${
                deck.tags.length > 0
                  ? `<span class="tag-list">${deck.tags
                      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
                      .join('')}</span>`
                  : ''
              }
            </div>
            <div class="slide-nav">
              <div class="slide-nav-title">Slides</div>
              <ul class="slide-list">
${deck.slideItems
  .map(
    (slide) => `                <li>
                  <a class="slide-link" href="${deck.url}${slide.no}">
                    <span class="slide-no">${slide.no}</span>
                    <span class="slide-label">${escapeHtml(slide.label)}</span>
                  </a>
                </li>`
  )
  .join('\n')}
              </ul>
            </div>
          </li>`
  )
  .join('\n')}
        </ul>`
      }
    </main>
  </body>
</html>
`;
};

const main = async () => {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distSlidesDir, { recursive: true });

  if (!(await pathExists(slidesDir))) {
    await fs.mkdir(slidesDir, { recursive: true });
  }

  const entries = await fs.readdir(slidesDir, { withFileTypes: true });
  const deckDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const decks = [];

  for (const rawName of deckDirs) {
    const slug = slugify(rawName);
    if (!slug) {
      continue;
    }

    const markdownPath = path.join(slidesDir, rawName, 'slides.md');
    if (!(await pathExists(markdownPath))) {
      continue;
    }

    const metadata = await readDeckMetadata(markdownPath, rawName);
    const markdownStat = await fs.stat(markdownPath);
    const outDir = path.join(distSlidesDir, slug);

    console.log(`Building ${rawName} -> dist/slides/${slug}`);
    await runCommand('npx', ['slidev', 'build', markdownPath, '--out', outDir, '--base', './']);

    decks.push({
      slug,
      url: `./slides/${slug}/`,
      startUrl: `./slides/${slug}/1`,
      updatedAt: formatDate(markdownStat.mtime),
      ...metadata,
    });
  }

  decks.sort((a, b) => a.title.localeCompare(b.title, 'en'));

  const landingHtml = buildLandingPage(decks);
  await fs.writeFile(path.join(distDir, 'index.html'), landingHtml, 'utf8');
  await fs.writeFile(path.join(distDir, '404.html'), landingHtml, 'utf8');

  console.log(`Built landing page with ${decks.length} deck(s).`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
