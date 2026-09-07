# rehearsio.com

The four pages behind [rehearsio.com](https://rehearsio.com): what the app is,
the privacy policy, the terms of use, and the German provider identification.

Static files — four pages, one stylesheet, one script, some pictures. No build
step, no framework, no server. They are served by GitHub Pages from the
`main` branch of `mmammad/rehearsio-site`, and `CNAME` next to them is what
points the domain at it.

**The source of truth is the app's own repository**, in its `site/` folder;
this repository is a published copy of that folder and is updated from it with

```
git subtree push --prefix=site site main
```

so nothing here should be edited in place — an edit made here is an edit that
the next publish will overwrite.
