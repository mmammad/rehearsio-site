# rehearsio.com

The four pages behind [rehearsio.com](https://rehearsio.com): what the app is,
the privacy policy, the terms of use, and the German provider identification.

Static files — no build step, no framework, no server. They are served by
GitHub Pages from the `main` branch of `mmammad/rehearsio-site`, and `CNAME`
next to them is what points the domain at it.

| File | What it is |
|---|---|
| `index.html`, `home.css`, `home.js` | The front page: the story of one practice session, the working copy of a session, the store links. `home.*` is loaded by this page only |
| `privacy.html`, `terms.html`, `impressum.html` | The three legal pages, linked as `/privacy`, `/terms`, `/impressum` — Pages serves the file without its extension; `site.js` keeps `#…` out of the address bar |
| `styles.css`, `site.js` | Shared by all four: the app's own tokens, the header, the theme switch |
| `assets/media/` | Every picture on the front page, **generated** — see below |
| `assets/audio/` | The metronome's two clicks, copied from the app's `assets/audio` |
| `assets/og.jpg` | The picture a shared link shows, generated with the rest |
| `robots.txt`, `sitemap.xml` | For search engines |

**The pictures are made, not edited.** `tools/build-site-media/build.py` in the
app's repository cuts them from the owner's design exports — the drawings into
layers, the store cards below their titles — and writes `assets/media/` and
`assets/og.jpg` from scratch every time. A picture changed by hand here is a
picture the next build throws away.

**The source of truth is the app's own repository**, in its `site/` folder;
this repository is a published copy of that folder and is updated from it with

```
git subtree push --prefix=site site main
```

so nothing here should be edited in place — an edit made here is an edit that
the next publish will overwrite.
