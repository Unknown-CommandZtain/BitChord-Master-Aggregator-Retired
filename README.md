# BitChord FLAC Aggregator Addon by Unknown_CommandZtain 🎧

**A practical reference guide to a FLAC-first music addon written in JavaScript for Cloudflare Workers.** This README explains the architecture, setup, source management, diagnostic tools, performance trade-offs, and lessons learned so that other developers can build **their own permission-aware aggregators**.

> **Current private reference:** `v3.7.17-p8-stable` (manifest version `3.7.17`, patch revision `p8`)  
> **Last documentation review:** 2026-11-03  
> **Platform:** Cloudflare Workers (JavaScript)  
> **Client interface:** BitChord-compatible `manifest`, `search`, and `stream` endpoints  
> **Audience:** Learners, hobby developers, and operators integrating sources they are authorized to use  
> **Status:** The owner has reported successful FLAC handoffs with this build; provider availability and client playback are not independently guaranteed  
> **Affiliation:** Independent, unofficial project. Not affiliated with BitChord, Cloudflare, or any music provider discussed here.

**This is documentation, not the owner's ready-to-deploy Worker.** The private implementation has endpoint identifiers and provider-specific behavior that are deliberately **not published here**. A Cloudflare account plus this README alone will not create a functioning music service. Supply authorized providers and your own compatible implementation.

> [!IMPORTANT]
> A provider's `LOSSLESS` badge is metadata, not proof. Seeing the first four bytes `fLaC` verifies a FLAC signature, **not** full-file integrity, a genuine lossless master, correct recording identity, or successful playback on the client. Evaluate those separately.

## Contents

- [What does this project do?](#what-does-this-project-do)
- [Start here: build your own addon](#start-here-build-your-own-addon)
- [How the aggregator works](#how-the-aggregator-works)
- [Choosing and configuring providers](#choosing-and-configuring-providers)
- [Adaptive provider priority](#adaptive-provider-priority)
- [FLAC verification, multilingual search and Atmos](#flac-verification-multilingual-search-and-atmos)
- [Environment variables and Cloudflare bindings](#environment-variables-and-cloudflare-bindings)
- [Health dashboard and diagnostics](#health-dashboard-and-diagnostics)
- [Optional R2 storage](#optional-r2-storage)
- [API contract and examples](#api-contract-and-examples)
- [Testing your deployment](#testing-your-deployment)
- [Troubleshooting](#troubleshooting)
- [Security, costs, and rights](#security-costs-and-rights)
- [Porting to another hosting platform](#porting-to-another-hosting-platform)
- [Development history and roadmap](#development-history-and-roadmap)
- [Further reading](#further-reading)

## What does this project do?

A music aggregator searches **multiple compatible and authorized sources**, collects candidate recordings, checks that they describe the intended track, and resolves a stream for a supported player. If the primary source fails, it can attempt the **same recording** from another source rather than silently returning a different version or remix.

Its design goals are:

- **FLAC-first playback:** no unintended MP3, AAC, Opus, or other lossy substitution *inside this addon*.
- **Correct recordings:** conservative title, artist, duration, edition, Japanese/Romaji, and Vocaloid producer matching.
- **Responsive search:** staged, time-budgeted discovery with adaptive ordering and conditional retries.
- **Fault tolerance:** limited rescue attempts, temporary provider cooldowns, and inconclusive-probe handling.
- **Observable outcomes:** distinguish catalog search, byte-level probe, Worker handoff, and client playback.
- **Optional storage:** separate personal library and permitted 36-hour temporary cache, not enabled by default.

| Capability | Private reference implementation `v3.7.17-p8-stable` |
| --- | --- |
| Provider IDs | Stable slots `discord_0` through `discord_11` (12 total); `0`, `5`, `6`, `9` retired/reserved |
| Ordinary provider configuration | `discord_1`–`discord_4`, `discord_7`, `discord_8`; endpoint overrides and enable switches |
| Optional rotating providers | `discord_10` (Soundlink trial), `discord_11` (Lossless Bridge), both opt-in via secrets |
| Search | Performance-ranked, staged, bounded; explicit title/artist CJK retry only for eligible empty searches |
| Playback | Strict FLAC-byte checks by default; limited equivalent-recording recovery |
| Matching | Title, artist, duration, version, Vocaloid/anime metadata safeguards |
| Optional discovery | Internet Archive, Jamendo, Openverse, Wikimedia Commons where configured |
| Storage | Separate optional personal R2 library and permission-controlled 36-hour cache |
| Atmos | Optional E-AC-3 JOC, **not FLAC and not lossless** |
| Health | Read-only source status, sanitized 60-minute FLAC diagnostics; optional Cloudflare resource metrics |
| Shared diagnostic storage | Optional SQLite Durable Object (`FLAC_DIAGNOSTICS`); **not** a global provider-ranking database |
| Live endpoint status | Changes frequently; a working manifest is not a promise of playable FLAC |

## Start here: build your own addon

This is the recommended order for someone starting from scratch. **You do not need R2, Cron Triggers, Atmos, or multiple providers to build your first version.** Begin with one authorized source and expand only when the basics work.

### 1. Prepare the essentials

You need:

1. A Cloudflare account and access to **Workers & Pages**, or a different JavaScript server runtime you intend to adapt.
2. Working knowledge of JavaScript, JSON, HTTP requests, and HTTP response codes.
3. At least one **authorized** music catalog or compatible addon with a documented search/stream interface.
4. Worker source code that implements BitChord's expected routes. This README describes the structure but **does not contain a complete standalone Worker**.
5. A BitChord installation or another client able to test the same API contract.

Do **not** treat a publicly accessible search endpoint as automatic permission to stream, download, cache, redistribute, or charge for its recordings. Check the provider's terms, your authorization, and recording-level licenses.

### 2. Create a Worker

**Dashboard route:**

1. Sign in to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Open **Workers & Pages**, choose **Create application**, and create a Worker project.
3. Open the code editor or connect your own source repository.
4. Add your JavaScript Worker code and deploy to a `workers.dev` domain or a permitted custom domain.
5. Test its public `/manifest.json` endpoint before attempting music searches.

**Command-line route:** install a supported version of Node.js, then follow Cloudflare's current project scaffolding flow:

```bash
npm create cloudflare@latest -- my-music-addon
cd my-music-addon
# Implement and test the Worker in the generated src/ directory.
npx wrangler dev
# Deploy only after configuration and tests are ready.
npx wrangler deploy
```

Choose a **JavaScript Worker** when prompted. The generated project is a starting scaffold, **not** a working BitChord music addon. Cloudflare's project generator and dashboard labels may evolve; consult the linked official setup documentation.

### 3. Build and test the minimum endpoints

A compatible addon typically needs three public routes:

```text
GET /manifest.json
GET /search?q=Artist%20Song&quality=LOSSLESS
GET /stream/{provider}:{trackId}?quality=LOSSLESS
```

Implement them according to the **client's currently supported response schema**. Avoid inventing a response object or assuming any URL returned by an upstream is a playable FLAC. If you are adapting this project, review the actual manifest, routing, error handling, and ID encoding in your copy of the Worker.

**Minimum first-release checklist:**

- Manifest returns valid JSON and is recognized by the client.
- Search returns correctly shaped track metadata from an authorized catalog.
- Stream resolution returns an authorized, reachable playback URL only for an acceptable recording.
- A missing recording yields a meaningful error; it never silently becomes unrelated audio.
- Actual playback and seeking work on the client.
- Credentials, signed URLs, and personal listening histories are not exposed in logs.

### 4. Add resilience gradually

After the minimum addon works, introduce features in this order: strict FLAC checks, timeout/error handling, recording-aware matches, second-provider rescue, health-based ranking, optional open catalogs, and **only then** optional storage. Benchmark each step with known-good and deliberately failing examples.

### 5. Deploy carefully

Back up the previous working Worker. Keep provider IDs stable. Verify `/manifest.json`, try real searches and playback, inspect sanitized logs, and roll back if an update introduces regressions. **Local unit tests do not prove live provider availability or audible playback.**

## How the aggregator works

```text
BitChord-compatible client
  |
  +-- GET /manifest.json
  |
  +-- GET /search?q=...
  |      |
  |      +-- Rank authorized providers using seeded + recent health scores
  |      +-- Search the fastest group first
  |      +-- Expand to backups / optional catalogs if needed
  |      +-- Normalize title, artist, version and duration
  |      +-- Return candidate tracks (NOT yet proof of playable FLAC)
  |
  +-- GET /stream/{provider}:{trackId}?quality=LOSSLESS
         |
         +-- Check eligible unexpired, permitted R2 cache (optional)
         +-- Resolve requested upstream
         +-- In strict mode, inspect initial FLAC bytes
         +-- If unavailable, find equivalent recording from other sources
         +-- Return accepted playback metadata, or a clear error
         +-- Optionally cache a permitted FLAC copy in the background

BitChord must still fetch/decode/play the resolved stream itself.

Hourly Cloudflare Cron Trigger (optional cache): 0 * * * *
  +-- Delete expired temporary objects from FLAC_CACHE_BUCKET only
```

A resolver's HTTP `200` or `[PLAYBACK HANDOFF]` message means **the Worker handed a response to the client**. It does not establish that bytes were played. The client can also independently use other addons or fallback mechanisms outside this Worker's control.

## Choosing and configuring providers

### Authorized sources first

A candidate provider needs a documented and compatible search/stream API, reasonable availability, a usable FLAC output if claimed, and a clear permission model. A successful search does not prove playable audio or grant the right to download, cache, or redistribute recordings.

**No live manifest URLs, signed stream links, tokens, or rotating credentials are included in this public README.** Supply and test your own authorized integrations.

### Stable provider IDs in `v3.7.17-p8-stable`

| Slot(s) | Role | Lifecycle policy |
| --- | --- | --- |
| `discord_0` | Retired | Permanently reserved; no reactivation through an environment override |
| `discord_1`–`discord_4` | Ordinary compatible addons | Can be disabled or have their manifest URL updated without changing the slot |
| `discord_5`, `discord_6` | Retired/reserved | Never reuse |
| `discord_7` | Bluebit | Ordinary addon; may be disabled or overridden |
| `discord_8` | Soundfean | Ordinary addon; may be disabled or overridden |
| `discord_9` | Retired/reserved | Never reuse |
| `discord_10` | Optional Soundlink trial | Secret URL plus explicit enable flag; may expire or rotate |
| `discord_11` | Optional Lossless Bridge | Secret URL plus explicit enable flag; may expire, rotate, or be IP-bound |

**Never reorder or fill retired slots.** Saved track IDs embed the provider index; reassigning it risks resolving old IDs against the wrong catalog. The implementation also tags IDs for changed ordinary endpoints and rotating sessions to avoid silently replaying stale IDs.

### Switching an ordinary addon without editing JavaScript

For eligible ordinary indexes (`1`–`4`, `7`, `8`), the current private Worker reads:

```text
DISCORD_N_ENABLED=true
DISCORD_N_MANIFEST_URL=https://your-authorized-addon.example/manifest.json
```

Replace `N` with the **existing** slot number, and replace the example address with a valid authorized endpoint. The value can be an accepted base URL or its `/manifest.json` form. An explicit invalid override disables that slot rather than quietly returning to the outdated default. Set `DISCORD_N_ENABLED=false` to skip a provider temporarily. This is useful after a provider replaces an endpoint: **update the existing index; do not add a new one**.

The owner's `discord_3` provider recently changed endpoint, so the new authorized address should be configured with `DISCORD_3_MANIFEST_URL` rather than relying on the older URL baked into the p8 code. Endpoint reachability must still be verified independently.

### Optional rotating-provider restrictions

`discord_10` and `discord_11` have separate enable flags and **secret-only manifest URL** configuration. Their validator deliberately accepts narrowly scoped host/path formats. For `discord_11`, the current p8 code expects a verified manifest path ending in `/manifest.json`; a bare `/u/TOKEN` URL is **not accepted** by its configuration validator. Only append the suffix if the provider genuinely serves a compatible manifest there.

These safeguards cannot be bypassed merely by switching on the enable flag. A browser-accessible, IP-bound manifest may fail from Cloudflare's outbound network; respect the provider's access rules instead of trying to evade them.

### Source types

| Source type | When useful | Caveat |
| --- | --- | --- |
| Authorized compatible addon | Existing compatible catalogs | API, rights, freshness, quality, and rate limits vary |
| Internet Archive | Public archival discovery and qualifying FLAC files | Licenses and recording identities vary |
| Jamendo | Authorized artist catalog queries | Own client ID and API/licensing limitations |
| Openverse / Wikimedia Commons | Publicly indexed audio | Check the actual file's license |
| Personal R2 library | Owner-uploaded authorized FLAC | Current reference personal-audio route is **not authenticated** |
| Temporary R2 cache | Short-lived, permitted copies | Separate private bucket, explicit allowlist, signing, limits |

## Adaptive provider priority

The Worker prioritizes providers using a **seeded order plus recent per-isolate observations**, including accepted FLAC resolution, response latency, failed searches, and stream errors. A source that lists many `LOSSLESS` search results but never resolves verified audio is not necessarily a good first choice.

- Verified FLAC handoffs contribute stronger evidence than search badges.
- Slow or failing upstreams can fall into short-lived cooldowns.
- A stream-specific `404` or `410` is treated as a missing track, not necessarily a whole-provider outage.
- Search-level `401`/`403`/`404`/`410` can signal an unusable endpoint or credentials.
- Cooldowns and ranking observations live **in individual Worker isolates** and can reset on a cold start.
- The shared diagnostic Durable Object **aggregates sanitized evidence; it does not synchronize ranking or cooldown state**.

**Reference implementation limits** (not end-to-end response guarantees):

| Setting | Value in `v3.7.17-p8-stable` |
| --- | --- |
| Main search budget | 4,800 ms |
| Initial staged-search wait | 1,050 ms |
| Conditional simplified-search allowance | Up to 450 additional ms, only when retry begins |
| Simplified provider retry timeout | Up to 1,250 ms, bounded by remaining budget |
| Rescue search overall cap | 9,500 ms including primary resolution |
| Strict probe timeout | 1,600 ms default, configurable between 900 and 2,200 ms |

These budgets overlap: **do not add them together as a promised playback delay**. They are ceilings on particular internal operations, and the client and network introduce separate latency.

For fair provider comparisons, evaluate search success, exact recording identity, actual FLAC-byte verification, stream-handoff latency, errors, and playback on the intended device. Give replacement endpoints a fresh evaluation rather than assuming the previous URL's track record still applies.

## FLAC verification, multilingual search and Atmos

### Three different meanings of success

| Check | What it establishes |
| --- | --- |
| Search returns a `LOSSLESS` candidate | A catalog **claims** suitable audio exists |
| Probe observes `fLaC` at the start of returned audio | The accessible response has a FLAC signature, not complete provenance or playback proof |
| Client plays and seeks successfully | Playback worked for that tested stream, device, and moment |

### FLAC verification modes

| `FLAC_VERIFY_MODE` | Effect | Recommendation |
| --- | --- | --- |
| `strict` (default) | Requires accepted FLAC-byte evidence; inconclusive checks do not pass | **Recommended** for FLAC-only operation |
| `adaptive` | May accept some unresolved probes based on metadata | Not a strict FLAC guarantee |
| `off` | Skips probing for some metadata-qualified addon streams | Testing/trusted environments only |

Unrecognized values revert to `strict`. Optional rotating providers `discord_10` and `discord_11` still use **strict verification** even if a weaker global setting is supplied. Metadata-free responses require byte proof.

`FLAC_PROBE_TIMEOUT_MS` defaults to `1600` and is clamped between `900` and `2200` milliseconds. A timed-out or inaccessible probe is **inconclusive**, not evidence that the source is lossy. The Worker accepts direct FLAC-compatible media only; playlist links ending in `.mpd` or `.m3u8` are **not** supported as FLAC handoffs in p8, even if a provider labels them `flac`.

### Japanese, Korean, Chinese and Vocaloid matching

The Worker uses conservative identity and recording-version checks for multilingual titles and producer aliases. **Patch p8** adds a narrowly limited discovery retry for explicitly labeled CJK title/artist searches, for example:

```text
ラビットホール by DECO*27
```

If the initial search has **no eligible lossless candidates**, one available provider may try the title alone. A retry result still needs to match the full original artist/title identity. This is not generalized transliteration, not a retry after every failed stream, and **not** guaranteed to activate when an initial search returns candidates. A candidate found under a different title, mix, producer, or duration can still be rejected correctly.

### Optional Dolby Atmos

When the upstream provides actual E-AC-3 JOC metadata and the client explicitly requests Atmos, the Worker can expose it separately from standard FLAC:

- Set `ATMOS_ENABLED=true` and have the client send `atmos=auto`.
- Normal requests remain FLAC-only under the configured verification policy.
- E-AC-3 JOC is **lossy immersive** audio, not Hi-Res FLAC.
- The temporary FLAC R2 cache does not store Atmos audio.
- Client/device compatibility and authorized upstream availability remain necessary.

## Environment variables and Cloudflare bindings

These are names used by the **private `v3.7.17-p8-stable` reference**, not universal BitChord requirements. Configure only features you actually need.

| Variable or binding | Kind | Purpose |
| --- | --- | --- |
| `DISCORD_N_ENABLED` | Text (`N=1..4,7,8`) | Set `false` to disable one ordinary addon without removing its slot |
| `DISCORD_N_MANIFEST_URL` | Secret if credential-bearing | Override one ordinary provider's valid manifest/base URL |
| `SOUNDLINK_WORKER_ENABLED` | Text | Enable optional `discord_10` only when authorized |
| `SOUNDLINK_MANIFEST_URL` | **Secret** | Optional rotating trial manifest; strict host/path validation |
| `LOSSLESS_BRIDGE_WORKER_ENABLED` | Text | Enable optional `discord_11` only when authorized |
| `LOSSLESS_BRIDGE_MANIFEST_URL` | **Secret** | Optional Lossless Bridge manifest; must pass current validator |
| `FLAC_VERIFY_MODE` | Optional text | `strict` (default), `adaptive`, `off` |
| `FLAC_PROBE_TIMEOUT_MS` | Optional text | Default `1600`, allowed `900..2200` ms |
| `ATMOS_ENABLED` | Optional text | Enable explicitly requested E-AC-3 JOC |
| `OPENVERSE_ENABLED`, `COMMONS_ENABLED` | Optional text | Enable optional public-source discovery |
| `JAMENDO_CLIENT_ID` | Authorized credential | Jamendo queries only when configured |
| `HEALTH_DASHBOARD_ENABLED` | Text | `true` exposes `/health` dashboard and its sanitized JSON |
| `FLAC_DIAGNOSTICS` | SQLite Durable Object binding | Optional shared 60-minute diagnostic counters across isolates |
| `HEALTH_RESOURCE_METRICS_ENABLED` | Text | Enables optional read-only Cloudflare Analytics queries from `/health` |
| `HEALTH_CF_ACCOUNT_ID`, `HEALTH_CF_WORKER_NAME` | Text | Identify the account and Worker for resource metrics |
| `HEALTH_CF_API_TOKEN` | **Secret** | Read-only authorized Cloudflare Analytics token |
| `HEALTH_CPU_BUDGET_MS` | Optional text | Configured per-request CPU budget for a **ratio**, not CPU utilization |
| `HEALTH_R2_METRICS_ENABLED` | Text | Enable optional account-wide R2 metric lookup |
| `HEALTH_R2_API_TOKEN` | **Secret** | Authorized token for optional R2 storage metrics |
| `HEALTH_R2_BUDGET_GIB` | Optional text | User budget denominator for a storage ratio, not a disk limit |
| `SOURCE_CHECK_TOKEN` | **Secret** | 32+ character token enabling authenticated `POST /health/source-check` |
| `FLAC_BUCKET` | R2 bucket binding | Optional personal library |
| `FLAC_CACHE_BUCKET` | **Separate** R2 binding | Optional private temporary audio cache |
| `FLAC_CACHE_ENABLED` | Text | `true` only when cache prerequisites are met |
| `FLAC_CACHE_SIGNING_KEY` | **Secret** | Random 32+ character HMAC signing key |
| `FLAC_CACHE_ALLOWED_PROVIDERS` | Text | Explicit authorization-based allowlist; blank denies cache writes |

Use Cloudflare **Workers & Pages → Worker → Settings → Variables and Secrets** for runtime values and secrets, and bindings for R2/Durable Objects. Dashboard locations can change. Settings must be applied to the **same deployment/environment** serving the live Worker.

Example `wrangler.toml` excerpt for **optional** R2; not a complete project:

```toml
[[r2_buckets]]
binding = "FLAC_BUCKET"
bucket_name = "your-personal-flac-bucket"

[[r2_buckets]]
binding = "FLAC_CACHE_BUCKET"
bucket_name = "your-separate-temporary-cache-bucket"

[triggers]
crons = ["0 * * * *"]
```

Register the Durable Object class `BitChordDiagnosticsDO` and bind it as `FLAC_DIAGNOSTICS` only when your own Worker code, migration, and Cloudflare configuration support it. Its absence falls back to per-isolate diagnostics. The correct binding is **not** created merely by defining an environment variable with that name.

Do not commit `.dev.vars`, `.env`, manifest URLs carrying tokens, Cloudflare API credentials, or signed audio links. Use secrets or appropriate secret-management commands (for example, `wrangler secret put FLAC_CACHE_SIGNING_KEY`).

## Health dashboard and diagnostics

The private p8 Worker provides **passive, read-only health reporting** when explicitly enabled:

| Route | Purpose | Access characteristics |
| --- | --- | --- |
| `GET /health` | HTML dashboard: configured sources, local stream/search health, diagnostics, optional resource readings | No built-in authentication in reference code; consider Cloudflare Access |
| `GET /health?format=json` | Full sanitized health snapshot | Same access precautions |
| `GET /health?format=diagnostics` | Sanitized FLAC diagnostic snapshot | Same access precautions |
| `POST /health/source-check` | Active check of one chosen provider and one query | Requires `Authorization: Bearer <SOURCE_CHECK_TOKEN>` and a valid 32+ character secret |

`/health/source-check` is **off unless `SOURCE_CHECK_TOKEN` is configured**. It is rate-limited (best-effort per isolate) to one check per provider every 30 seconds, inspects at most two matching stream candidates, and does **not** update ordinary playback success counters. One verified sample does not prove catalog-wide availability or client playback. Do not put secrets in URLs or logs.

### How to interpret the counters

- `stream_route_hits` counts requests entering the stream route **before** track-ID/session validation.
- `stream_requests` counts requests that pass validation and proceed to resolution.
- `flac_handoffs` means the Worker returned verified FLAC playback metadata, **not** that the client played the full track.
- `stream_unavailable`, `rescue_exhausted`, and mismatch reasons help explain failed upgrades; they are not necessarily unique songs.
- `provider_search_errors` counts provider-level failures, potentially multiple for one user search.
- `simplified_retries` counts the special p8 discovery retry. A zero means it did not activate, **not** that multilingual searching was completely disabled.
- Cooldown events are displayed separately from failure reasons to avoid counting one failure twice merely because it triggered a cooldown.

The rolling diagnostic window is **60 minutes**. With `FLAC_DIAGNOSTICS` bound, aggregate safe counters are shared through a SQLite Durable Object. Otherwise they are only local to one Worker isolate, and a dashboard visit may land on a different isolate from a playback request. Provider-ranking and cooldown scores remain isolate-local **in both cases**. Historical Durable Object counters may span recent patch deployments within that window.

### Optional resource meters are not server utilization

The Health page can show read-only Cloudflare-derived CPU, V8 isolate-memory, and R2 storage data, but not the underlying machine's CPU/RAM/disk usage. A CPU percentage is **P50 CPU time divided by your configured per-request CPU budget**, not host CPU utilization. The RAM ratio uses a reported isolate memory sample against a nominal 128 MB limit, while the R2 figure is **account-wide stored bytes divided by an optional user-defined budget**, not a Worker disk percentage. Missing access/metrics should appear as unavailable rather than a fabricated `0%`.

> [!CAUTION]
> The reference Health HTML and JSON endpoints are **not authenticated merely by enabling the dashboard**. Although they omit raw tokens/URLs, use Cloudflare Access or another protective layer for a private installation. Only enable the read-only Cloudflare API permissions required for optional metrics.

## Optional R2 storage

R2 is **not required** for ordinary provider aggregation. Introduce it only when you need storage, understand its costs, and have the rights to store the audio.

### A. Personal library: `FLAC_BUCKET`

Use a dedicated bucket for recordings you are entitled to store. In the current reference Worker, register tracks using `PERSONAL_FLAC_TRACKS`:

```js
const PERSONAL_FLAC_TRACKS = [
  { key: "MyMusic/Artist - Song.flac", title: "Song", artist: "Artist", duration: 240 }
];
```

The existing route is `/audio/personal/{index}.flac`, with GET/HEAD and byte-range support.

> [!CAUTION]
> **Current privacy limitation:** This route is **not authenticated in v3.7.17-p8-stable**. A private R2 bucket does not make a public Worker route private. Anyone who discovers a valid personal-audio URL/index may retrieve the file. Do **not** put private or non-redistributable recordings behind this public endpoint. Before using it as a truly private library, implement and test authentication, authorization, non-enumerable access, and protected searches.

### B. Temporary cache: `FLAC_CACHE_BUCKET`

Create a **separate private R2 bucket** (no public `r2.dev` or public bucket domain), bind it as `FLAC_CACHE_BUCKET`, and enable caching only for recordings/providers with appropriate copying permission. Leave `FLAC_CACHE_ALLOWED_PROVIDERS` empty during initial setup.

| Cache policy | Reference implementation |
| --- | --- |
| Retention | **36 hours** from upload; expired entries not served |
| Physical cleanup | Hourly `scheduled()` handler at `0 * * * *`, executed on UTC schedule |
| Individual file maximum | **100 MiB** |
| Target total storage | Approximately **2 GiB**, a best-effort software target rather than an enforced billing cap |
| Missing content length | Does **not** automatically cache unknown-size files |
| File identification | Requires downloaded bytes beginning with `fLaC` |
| Permission | Explicit `FLAC_CACHE_ALLOWED_PROVIDERS` after verifying the relevant license/terms |
| First-play response | Return source stream first; background save is best-effort via `ctx.waitUntil()` |
| Cached playback | Short-lived HMAC-signed URL, normally up to **6 hours**, also bounded by file expiry; range support |
| R2 keys | Hashed names under `bc-flac-cache-v1/` |

Configure hourly Cron **only if** the correct `scheduled()` handler is deployed and you understand its cleanup scope. Never aim temporary cleanup at the personal-library bucket. Cloudflare Cron changes can take time to propagate. An R2 lifecycle rule for the temporary prefix can provide additional cleanup insurance but is **not** the exact 36-hour read-expiry mechanism.

Example signing-key generation:

```bash
openssl rand -base64 48
```

Store the output as a Cloudflare **secret**, never in a README or source file. Signed cache URLs are **bearer links**; anyone who obtains an unexpired link may be able to replay it.

## API contract and examples

The routes below describe the private p8 reference project. They are **not a substitute for the current BitChord response schema**.

| Method | Example route | Function |
| --- | --- | --- |
| `GET` | `/manifest.json` | Addon metadata, version `3.7.17`, supported resources |
| `GET` | `/search?q=Artist%20Song&quality=LOSSLESS` | Candidate track metadata; **not yet proof** of playable FLAC |
| `GET` | `/stream/discord_8:{trackId}?quality=LOSSLESS` | Resolve acceptable FLAC or return an error |
| `GET` | `/stream/discord_8:{trackId}?quality=LOSSLESS&atmos=auto` | Explicit Atmos path, only when enabled |
| `GET`, `HEAD` | `/audio/cache/{hash}.flac?exp=...&sig=...` | Signed temporary-cache bytes, including range playback |
| `GET`, `HEAD` | `/audio/personal/{index}.flac` | Personal-library bytes; **currently unauthenticated** |

`discord_8` is a **slot illustration only**, not a guarantee that any particular source is suitable. Use a **real valid ID emitted by your own search implementation**, not the literal `{trackId}` placeholder. Do not expose live signed audio links or provider tokens in examples.

Simple, harmless smoke tests:

```bash
curl -i "https://YOUR-WORKER.workers.dev/manifest.json"
curl -i "https://YOUR-WORKER.workers.dev/search?q=Artist%20Song&quality=LOSSLESS"
```

Stream tests require an **authorized**, real track ID and must be followed by a device-level playback test. Never interpret a search-result quality label as evidence that the stream will play.

## Testing your deployment

Use a small, varied test set rather than testing only a few well-known songs. Include one recording known to have an official FLAC source, a remix-versus-original pair, Japanese/Romaji spelling variants if relevant, one intentionally unavailable item, and a slow/rate-limited provider in a local mock.

### Suggested test sequence

1. **Syntax and local regression:** for example, run `node --check your-worker.js` and your project's own mocked tests.
2. **Manifest and search:** verify the client recognizes the addon and that the returned metadata matches the intended song.
3. **FLAC verification:** test real `fLaC` bytes, known MP3/Opus responses mislabeled as lossless, and inconclusive/time-limited probes.
4. **Cross-source rescue:** make the primary source return 404; verify the exact recording is found elsewhere without substituting a different remix.
5. **Rate limiting:** simulate HTTP 429 and confirm cooldown and recovery behavior without retry storms.
6. **Actual playback:** confirm listening and seeking in BitChord on the devices and networks you expect to support.
7. **Optional cache:** only with permitted recordings, verify save, signed playback, expiry, seeking, and cleanup.
8. **Longer-term monitoring:** compare performance at different times and track improvements without sharing sensitive logs.

### Useful log markers

| Marker | Meaning |
| --- | --- |
| `[PROVIDER PRIORITY]` | Ranked query/rescue order for the current request |
| `[SEARCH PERFORMANCE]`, `[SEARCH READY]` | Query timing and result count; tracks are **not yet byte-verified** |
| `[UPSTREAM HTTP]`, `[UPSTREAM TIMEOUT]` | Provider errors and connectivity issues |
| `[PROVIDER COOLDOWN]` | Temporary isolation of a failing/rate-limited provider |
| `[MATCH REASONS]` | Candidate acceptance/rejection clues, such as different edits/remixes |
| `[FLAC PROBE]` | Confirmed / known non-FLAC / inconclusive signature check |
| `[FLAC RESCUE SUCCESS]`, `[FLAC RESCUE EXHAUSTED]` | Outcome of equivalent-track recovery |
| `[FLAC READY]`, `[PLAYBACK HANDOFF]` | Resolver succeeded and returned playback data, **not proof of listening** |
| `[STREAM UNAVAILABLE]` | No acceptable stream handed off |
| `[FLAC CACHE HIT]`, `[FLAC CACHE SAVED]`, `[FLAC CACHE SKIP]` | Optional cache status |

### Interpreting owner-side observations responsibly

A **2026-11-03 06:31 UTC** sanitized shared-diagnostics snapshot (six active minutes) reported:

| Measure | Observed events |
| --- | ---: |
| Search requests / searches returning candidates | 14 / 14 |
| Stream requests | 9 |
| Verified FLAC handoffs | 7 |
| Stream unavailable | 2 |
| Rescue successes / attempts | 4 / 6 |
| Provider-level search errors | 84 |
| FLAC handoffs from `discord_8` | 7 |
| FLAC handoffs from all other providers combined | 0 |

That is **7/9 (77.8%) handoffs per stream request in this small sample**, not an expected catalog success rate, unique-track metric, full listening test, or independent uptime audit. The same window included many failures against other providers, especially timeout-type `504` events. `discord_3` returned search results in part of this sample after an endpoint replacement, but **no verified FLAC handoff** from that source was recorded. A prior rolling sample was significantly less successful; windows and workloads were different, so it is **not a controlled before/after experiment**.

Do not share raw credentials, signed URLs, track identifiers, IP addresses, or unredacted production logs when requesting help.

## Troubleshooting

| Symptom | Things to investigate |
| --- | --- |
| Search shows `LOSSLESS`, but playback skips | The stream may be missing, mislabeled, inaccessible, expired, or rejected by strict FLAC probing |
| `[FLAC READY]` followed by a skip | The client still has to fetch/decode the URL; inspect URL expiry, HTTP Range, network reachability, and playback support |
| Probe timeout | Keep `strict`; inspect CDN response times and use `FLAC_PROBE_TIMEOUT_MS` conservatively, up to the implemented 2,200 ms cap |
| Repeated 404/410 | Recording or provider ID may no longer exist; try an equivalent authorized source |
| 429/502/503/504 | Rate limiting, provider failure, or gateway issue; avoid aggressive retries |
| Wrong edit/remix | Compare title/version tags, duration, and `[MATCH REASONS]` |
| Japanese title not found | Try the original script, accepted romanization, or correct producer name |
| Provider suddenly ranks low | Check actual verified FLAC success, recent latency, 429 cooldown, and whether its endpoint has changed |
| Rankings reset | Expected: current scores are stored only in each Worker isolate |
| Old saved track breaks after a provider change | Confirm the existing source **index** still refers to the expected provider |
| R2 cache stays empty | Optional configuration absent, permission allowlist empty, source not cacheable, file too large, or background save failed |
| Cache link gives 403/404 | Signature expired/invalid, object expired/deleted, or R2 not configured |
| R2 personal audio accessible to others | Current `/audio/personal/` route has **no access control**; disable exposure until protected |
| Opus plays despite FLAC-only Worker | BitChord may independently select another addon/source, outside this Worker's control |
| Optional public catalog empty | Those APIs may have limited FLAC coverage; metadata availability does not guarantee authorized audio |
| `/health` says provider `disabled` despite enable flag | Verify both flag and manifest secret, validator-required host/path, and correct deployed environment; `configured=false` is a config outcome, not a live stream test |
| New ordinary-addon URL is available but old one still fails | Update the **same** `DISCORD_N_MANIFEST_URL` slot, leave index stable, and recheck `/health` and `/health/source-check` |
| `discord_11` disabled with a base `/u/TOKEN` address | p8 validator requires an authorized `/u/TOKEN/manifest.json` structure; validate actual manifest support, do not blindly append or bypass access control |
| DASH or HLS endpoint says FLAC but cannot play | `.mpd` / `.m3u8` playlist URLs are unsupported in the p8 strict direct-FLAC path |
| Many HTTP `504` diagnostics | Some `504` labels are Worker-generated timeout outcomes; diagnose slow upstreams and per-isolate cooldowns before assuming all were literal upstream 504 responses |
| Dashboard counters disagree with source status | Shared 60-minute diagnostics may include events from older deployment windows; source rows use current config and isolate-local activity |

## Security, costs, and rights

**Keep the following protections from the first prototype onward:**

- **Never publish credentials or private endpoint identifiers.** Keep provider access tokens, signed playback URLs, Worker account IDs, personal network identifiers, and raw logs out of GitHub issues and README files. Rotate exposed credentials when appropriate.
- **Protect your routes, not just your buckets.** A private R2 bucket can still be exposed by an unauthenticated Worker route. The reference personal-library endpoint needs access control before sensitive tracks are used.
- **Treat source authorization separately from playback capability.** A source that serves FLAC is not automatically authorized for downloading, caching, redistribution, or use in a public music service.
- **Use a license for any code you want others to reuse.** This README explains concepts and configuration; it does **not** grant rights to private provider credentials or third-party recordings. If publishing reusable code, choose an explicit software license and verify dependencies.
- **Plan for costs.** Free-plan allowances differ by Cloudflare product and can change. R2 storage, operations, Workers usage, and optional future D1/Queues each have their own limits/billing. The 2 GiB cache target is not a spending cap.
- **Avoid access-control bypasses.** Do not rely on leaked tokens or unofficial subscription proxies. Respect provider policies and copyright.
- **Audit logs.** Prefer sanitized provider indexes, status codes, and aggregate timing over raw URLs, IPs, identifiers, or listener data.
- **Protect observability routes.** The reference `/health` dashboard is not authenticated by default, while the active source-check endpoint requires its own bearer token. Restrict private installations with Cloudflare Access or equivalent access controls.
- **Never bypass provider restrictions.** IP-bound or expired manifests may fail even when an authorized browser can access them; investigate official provider guidance instead of evading authorization.

> [!WARNING]
> A valid FLAC file may have originated from a lossy source. Neither a frequency-spectrum checker nor the `fLaC` magic header can prove source provenance. For stronger confidence, acquire a trustworthy artist/label release and compare the same version/master.

## Porting to another hosting platform

Cloudflare Workers are the **only runtime for which the current reference implementation is prepared and tested**. You can adapt the architecture to Node.js, another edge runtime, or a server, but **do not assume the source works unchanged**.

A port needs equivalents for:

- Request routing, streaming responses, cancellations, request limits, and standard Web Crypto functionality.
- Timeout handling and bounded parallel searches.
- R2 bindings or compatible object-storage SDKs for optional storage.
- Cron Triggers or a separately scheduled cleanup job.
- Secrets/configuration management and restrictive public-route authentication.
- Testing of byte-range requests, caching, and client network access in the chosen runtime.

**For beginners, Cloudflare Workers is the documented path.** Start with stateless search/stream behavior; migrate to other hosting only when you understand the platform differences.

## Development history and roadmap

### Current private reference: `v3.7.17-p8-stable`

- Public manifest version remains **`3.7.17`** while patch revision `p8-stable` is surfaced through the Health/diagnostic responses.
- p8 allows a narrowly restricted CJK title-only recovery search when a query uses an explicit title/artist separator and initial eligible lossless results are empty; returned tracks still face strict title/artist matching.
- p7 includes authenticated, on-demand source sampling and conservative direct-FLAC stream checks. A source-check result is a **single-sample diagnostic**, not playback proof.
- The 3.7.17 line includes a read-only Health dashboard, optional Cloudflare Analytics/R2 resource metrics, rolling sanitized FLAC failure diagnostics with an optional shared Durable Object, more careful recording matching, bounded retries, and safer handling of retired/rotating provider slots.
- The owner's November 3 sample demonstrated seven verified Worker FLAC handoffs out of nine stream requests, all from one provider. It is **not** a stable service-wide success estimate.
- The owner reported a replacement endpoint for ordinary provider `discord_3`. The **p8 default source still contains its earlier address**; current deployments should use the existing slot's authorized Cloudflare override until a later code change is deliberately made.

### Release history

| Version | Main development milestone |
| --- | --- |
| **3.7.17-p8-stable** | Explicit-title/artist CJK search retry for eligible empty searches; strict original-query filtering |
| **3.7.17-p7** | Authenticated one-provider source check; fail-closed source and stream compatibility behavior |
| **3.7.17 (earlier patches)** | Bounded search recovery, safe diagnostics, Health dashboard, shared optional FLAC counters, provider/session safeguards |
| **3.7.10** | Adaptive performance-based provider ordering while retaining saved track indices |
| **3.7.9** | Configurable strict FLAC probe, bounded recovery, clearer handoff diagnostics |
| **3.7.8** | Retry inconclusive FLAC probes without treating them as proven lossy |
| **3.7.7** | Japanese/Romaji/Vocaloid and anime-matching improvements |
| **3.7.6** | Opt-in E-AC-3 JOC Atmos, separate from FLAC |
| **3.7.5** | Private permission-controlled 36-hour R2 cache and signed playback |
| **3.7.4** | Optional Openverse and Wikimedia Commons discovery |
| **3.7.3** | More version-aware recording matching |
| **3.7.2** | Game soundtrack matching and diagnostics |
| **3.7.1** | Staged-search responsiveness |
| **3.7.0** | Internet Archive, optional Jamendo and optional personal R2 library |
| **3.6.1** | Cooldowns and failure-aware ordering |
| **3.6.0** | Faster resolution and lossy rejection |
| **3.5.0** | Cross-provider FLAC rescue |

## Further reading

- [Cloudflare Workers: dashboard quickstart](https://developers.cloudflare.com/workers/get-started/dashboard/)
- [Cloudflare Workers: CLI quickstart](https://developers.cloudflare.com/workers/get-started/guide/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [R2 Workers API and bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [R2 object lifecycle policies](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Internet Archive developer documentation](https://archive.org/developers/)
- [Jamendo API](https://developer.jamendo.com/v3.0/tracks)
- [Openverse API](https://api.openverse.org/v1/)
- [Wikimedia Commons / MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page)

---

**Build your own responsibly:** begin with an authorized source, verify FLAC bytes, keep saved provider IDs stable, protect private audio, and measure *actual playback* rather than treating a search badge as proof. 🎵
