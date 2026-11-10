# BitChord Master Aggregator

**Public educational archive | v3.7.17-p11 | retired 10 November 2026**

> **Status: Discontinued / read-only historical reference.** This repository is NOT an official BitChord component, an active streaming provider, a catalogue of working third-party add-ons, or a way to circumvent device authentication. Do not deploy it expecting live FLAC sources.

BitChord Master Aggregator was a personally developed Cloudflare Worker experiment exploring audio search, recording identity, FLAC handoff verification, fault-tolerant upstream queries and diagnostics. Development ended on 10 November 2026 in view of changes to the upstream addon ecosystem and device-based authentication.

## What readers can learn

- **Multilingual identity matching.** Canonical and alternate Japanese/English titles, artist/album checks and edition-aware matches. The final p11 patch handles title combinations such as a Japanese title followed by its English equivalent.
- **Defensive FLAC validation.** Compare format metadata with the beginning of the audio payload (`fLaC`), and distinguish confirmed from inconclusive probes. A valid FLAC container does NOT establish lossless source provenance or permission to cache media.
- **Resilience and bounded work.** Provider timeouts, staged search attempts, cooldowns, failure taxonomy and rate limiting.
- **Cloudflare primitives.** Worker fetch handling, optional SQLite-backed Durable Object counters, optional R2 caching and signed cache playback paths.
- **Safety choices.** No encrypted media/DRM bypass, no impersonation of official apps, no automatic credential harvesting, and no cached content without authorization.

## Public archive scope and caveats

The published `src/worker.js` is **sanitized from the final p11 source**. All formerly embedded third-party addon endpoint URLs, secret-bearing paths, host allowlists, and private environment values are omitted; disabled provider slots remain as historical structure. Public Archive, Jamendo, Openverse, Wikimedia Commons and Cloudflare API route references are included as historical integration examples. Some public APIs require a developer account or might have changed. No providers are configured or guaranteed to work.

The source has not been adapted for the upcoming BitChord authentication rollout. In particular, **it is not proof that the app will accept this addon**, nor that protected upstream addons can be accessed by a Worker. For work on authenticated media systems, use developer-approved integrations, API documentation, and credentials issued for server-to-server use.

## Files

- [`src/worker.js`](src/worker.js): sanitized final-source educational reference.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): components and request flow.
- [`docs/FLAC-VERIFICATION.md`](docs/FLAC-VERIFICATION.md): verification strengths and limits.
- [`docs/RETIREMENT.md`](docs/RETIREMENT.md): rationale and final version.
- [`docs/SECURITY.md`](docs/SECURITY.md): publication and privacy precautions.
- [`docs/LEARNING_GUIDE.md`](docs/LEARNING_GUIDE.md): developer reading order and offline exercises.
- [`docs/PUBLISHING_CHECKLIST.md`](docs/PUBLISHING_CHECKLIST.md): safe GitHub publication and archiving sequence.
- [`examples/wrangler.example.jsonc`](examples/wrangler.example.jsonc): optional deployment shape, no credentials or bindings.
- [`tests/smoke.mjs`](tests/smoke.mjs): basic structure and fail-closed checks.

## Historical code / local validation

```bash
node --check src/worker.js
node tests/smoke.mjs
```

No live upstream, BitChord device, R2, or account deletion tests are performed. **This archive is not production-ready.** Source modifications should be reviewed, secured and tested by anyone adapting it for independently authorized services.

## Rights, attribution and publication

This archive **does not yet contain an explicit software license**. Reading the code for educational purposes is the project's goal; further redistribution and modification rights require a license from the rights holder(s). See [`docs/LICENSING.md`](docs/LICENSING.md) for decisions to make before permitting forks and reuse. Credit original third-party software and respect its licensing when adapting an existing implementation.

## Final note

The active project concluded on **10 November 2026**. The preserved ideas can still inform future development without redistributing addon credentials or circumventing any developer's access controls.
