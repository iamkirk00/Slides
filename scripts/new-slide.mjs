import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const slidesDir = path.join(rootDir, 'slides');

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const requestedTitle = process.argv.slice(2).join(' ').trim();

if (!requestedTitle) {
  console.error('Usage: npm run new-slide -- "Deck Title"');
  process.exit(1);
}

const slug = slugify(requestedTitle);
if (!slug) {
  console.error('Could not derive a valid folder name from the provided title.');
  process.exit(1);
}

const deckDir = path.join(slidesDir, slug);
const markdownPath = path.join(deckDir, 'slides.md');

await fs.mkdir(deckDir, { recursive: false }).catch((error) => {
  if (error?.code === 'EEXIST') {
    console.error(`Deck folder already exists: slides/${slug}`);
    process.exit(1);
  }
  throw error;
});

const starterDeck = `---
theme: default
title: ${requestedTitle}
---

# ${requestedTitle}

Welcome to your new Slidev deck.

---

# Next Steps

- Edit this file at \`slides/${slug}/slides.md\`
- Run \`npm run build:site\` to rebuild all published decks
`;

await fs.writeFile(markdownPath, starterDeck, 'utf8');
console.log(`Created slides/${slug}/slides.md`);
