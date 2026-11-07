---
name: GitHub frontend sync
description: Why GitHub frontend updates must also be applied to the Replit web artifact.
---

Treat `frontend` as the GitHub source tree, but remember that Replit previews and production publish `artifacts/meyfu-app`.

**Why:** GitHub updates can change `frontend` without updating the artifact copy, which makes the workspace and published app continue serving stale code even though the repository appears current.

**How to apply:** After pulling GitHub changes, mirror relevant frontend source/config changes into `artifacts/meyfu-app`, preserve deliberate artifact-only enhancements, then validate the artifact build and workflows before publishing.

Adapt upstream test fixtures and assertions to retained artifact enhancements rather than weakening production types or removing those enhancements.

**Why:** Upstream tests can target a simpler contract or page structure than the Replit artifact, so a direct test copy can fail even when the retained functionality is intentional.

**How to apply:** Verify the actual artifact types and rendered controls before adjusting imported tests; retain their behavioral checks.