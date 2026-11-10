# Developer learning guide

This archive is a record of an experiment, **not** a supported streaming addon or a maintained integration. It is best read in this order:

1. `src/worker.js`: start with `MANIFEST`, then the exported Worker's `fetch()` router.
2. `recordingMatchDecision()`, `titleVariants()`, and `artistCredits()`: how title aliases are matched without treating covers/remixes as identical.
3. `isFlacStream()`, `flacProbeCandidateIssue()`, and `probeExternalFlac()`: understand metadata claims versus verified FLAC header bytes.
4. `configuredAddonUrl()`: see how disabled/retired IDs and opt-in provider configuration are handled. All provider URLs were removed from the public archive.
5. `healthDashboardSnapshot()` and `BitChordDiagnosticsDO`: separate active-worker counters from shared storage and recognize that a handoff is not proof of playback.
6. R2 functions: learn about TTL, signer keys and authorized read-through caching. Do not publish bucket contents or signers.

## Suggested safe exercises

- Write unit tests for bilingual artist/title matching with mocked metadata.
- Create `Response` fixtures that simulate valid, truncated and non-FLAC headers, without downloading music.
- Simulate provider errors and measure local cooldown decisions using a stub `fetch` implementation.
- Explore caching using locally authored synthetic test bytes and an isolated test bucket.

## Not included

- Live tokens, personal manifest links, provider authentication keys or credential renewal routines.
- Workarounds for app-bound/device authentication, DRM, quotas or access restrictions.
- A guarantee of FLAC provenance or bit-perfect output.

For new projects, use authorized, documented APIs with independently obtained access and respect source licensing.
