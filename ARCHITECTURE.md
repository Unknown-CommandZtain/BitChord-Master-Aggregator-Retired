# Architecture reference

The historical implementation had a BitChord-compatible addon manifest and `/search` and `/stream` routes on a Cloudflare Worker, with optional R2 objects and a Durable Object for aggregated diagnostics.

```
Android app (historical client)
         |
    /manifest.json
    /search, /stream
         |
     Worker router
         |------- curated title / identity matching
         |------- staged provider requests (only when configured and permitted)
         |------- format screening / optional FLAC bytes check
         |------- optional authorized R2 cached audio
         |------- diagnostics Durable Object
```

## Recorded design decisions

- `DISCORD_ADDONS` preserves historical index slots for compatibility with saved track IDs. Retired indices remain unavailable.
- Private addon URLs were never suitable for a public repository and have been removed from the sample.
- `FLAC_VERIFY_MODE=adaptive` accepted certain metadata-backed handoffs when byte probes were inconclusive. This is a usability tradeoff, not verified FLAC provenance.
- Diagnostic reason counters represent evidence events, not unique songs. Handoffs represent server decisions, not confirmation of entire-song client playback.
- R2 uses opt-in cache bindings, permission allowlists and expiry rules. The 36-hour policy was a project configuration choice rather than a built-in R2 storage limit.
- Public references are not evidence that a third-party service permits aggregation. Always seek explicit API access where required.

See source for the complete historical flow, which is preserved as an educational reference and may not run as an active addon without significant updates and authorization.
