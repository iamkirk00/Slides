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

const readDeckTitle = async (markdownPath, fallbackTitle) => {
  const content = await fs.readFile(markdownPath, 'utf8');
  const lines = content.split('\n');
  const titleLine = lines.find((line) => line.startsWith('# '));
  if (!titleLine) {
    return fallbackTitle;
  }
  return titleLine.replace(/^#\s+/, '').trim() || fallbackTitle;
};

const buildLandingPage = (decks) => `<!doctype html>
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
        background: #0f172a;
        color: #e2e8f0;
      }
      main {
        max-width: 900px;
        margin: 0 auto;
        padding: 3rem 1.25rem 4rem;
      }
      h1 {
        margin-bottom: 0.75rem;
        font-size: 2rem;
      }
      p {
        color: #cbd5e1;
        line-height: 1.5;
      }
      .grid {
        list-style: none;
        padding: 0;
        margin: 2rem 0 0;
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      }
      .card {
        border: 1px solid #334155;
        border-radius: 0.75rem;
        background: #111827;
      }
      .card a {
        display: block;
        color: inherit;
        text-decoration: none;
        padding: 1rem;
      }
      .card-title {
        display: block;
        font-weight: 700;
        margin-bottom: 0.35rem;
      }
      .card-meta {
        display: block;
        color: #94a3b8;
        font-size: 0.9rem;
      }
      .empty {
        margin-top: 2rem;
        padding: 1rem;
        border-radius: 0.75rem;
        border: 1px dashed #64748b;
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
      <h1>Slidev Deck Hub</h1>
      <p>
        This landing page is generated from slide folders in <code>slides/&lt;deck-name&gt;/slides.md</code>.
        Add decks with <code>npm run new-slide -- "My Deck"</code>.
      </p>
      ${
        decks.length === 0
          ? `<section class="empty">No decks found yet. Create your first one with <code>npm run new-slide -- "My First Deck"</code>.</section>`
          : `<ul class="grid">
${decks
  .map(
    (deck) => `          <li class="card">
            <a href="${deck.url}">
              <span class="card-title">${escapeHtml(deck.title)}</span>
              <span class="card-meta">slides/${escapeHtml(deck.slug)}/slides.md</span>
            </a>
          </li>`
  )
  .join('\n')}
        </ul>`
      }
    </main>
  </body>
</html>
`;

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

    const title = await readDeckTitle(markdownPath, rawName);
    const outDir = path.join(distSlidesDir, slug);

    console.log(`Building ${rawName} -> dist/slides/${slug}`);
    await runCommand('npx', ['slidev', 'build', markdownPath, '--out', outDir, '--base', './']);

    decks.push({
      slug,
      title,
      url: `./slides/${slug}/`,
    });
  }

  const landingHtml = buildLandingPage(decks);
  await fs.writeFile(path.join(distDir, 'index.html'), landingHtml, 'utf8');
  await fs.writeFile(path.join(distDir, '404.html'), landingHtml, 'utf8');

  console.log(`Built landing page with ${decks.length} deck(s).`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
