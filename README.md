# Slidev Landing Hub

Yes, this is possible, and this repository is now set up to do it.

## What this repo does

- Uses **one landing page** (`dist/index.html`) as a central directory of decks
- Stores each deck in its own folder at `slides/<deck-name>/slides.md`
- Builds each deck to a public folder at `dist/slides/<deck-name>/`
- Deploys everything to **GitHub Pages** using a workflow on `main`

When someone clicks a deck link on the landing page, Slidev opens that deck in presentation mode from a public URL.

## Repository layout

```text
slides/
  welcome/
    slides.md
scripts/
  new-slide.mjs
  build-site.mjs
.github/workflows/
  deploy-pages.yml
```

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the site and all decks:

   ```bash
   npm run build:site
   ```

3. (Optional) Preview `dist/` locally with any static server.

## Create a new deck

Create a new folder + starter markdown automatically:

```bash
npm run new-slide -- "My New Deck"
```

This creates:

```text
slides/my-new-deck/slides.md
```

The starter frontmatter includes fields used on the landing page cards:

- `title`
- `description`
- `author`
- `tags`

## Author and run Slidev locally

- Open and edit any `slides/<deck-name>/slides.md`
- For live authoring of a specific deck:

  ```bash
  npm run slide:dev -- slides/<deck-name>/slides.md
  ```

## Publish flow (GitHub Pages)

1. Commit and push your markdown/landing changes to `main` (usually via PR merge).
2. GitHub Action `.github/workflows/deploy-pages.yml` runs automatically.
3. The workflow builds `dist/` and deploys to GitHub Pages.

### Resulting URLs

- Landing page: `https://<owner>.github.io/<repo>/`
- Deck: `https://<owner>.github.io/<repo>/slides/<deck-name>/`

If this is a user/organization pages repository (`<owner>.github.io`), the repo segment may be omitted.

## Example decks in this repo

- `slides/welcome/slides.md`
- `slides/about-me/slides.md` (editable profile template)
- `slides/scripture-versions/slides.md` (teaching-with-clarity lesson + translation comparisons)
