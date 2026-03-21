---
theme: default
title: Welcome Deck
description: Quick orientation for how this repository publishes multiple Slidev decks.
author: Repository Maintainer
tags: [intro, workflow]
---

# Welcome Deck

This repository hosts multiple Slidev decks from one landing page.

---

# How it works

- Each deck lives at `slides/<deck-name>/slides.md`
- Build output is published to `dist/slides/<deck-name>/`
- The landing page links every built deck

---

# Create another deck

Run:

```bash
npm run new-slide -- "Quarterly Update"
```
