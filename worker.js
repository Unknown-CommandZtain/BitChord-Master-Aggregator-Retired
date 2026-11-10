// BitChord Master Aggregator v3.7.17-p11 | FINAL PUBLIC EDUCATIONAL ARCHIVE
// Project retired 2026-11-10. This file is NOT the former private deployment.
// All third-party provider URL defaults, credentials and host allowlists have been removed.
// No external addon is configured by default. Use ONLY independently authorized sources.
// The old configuration and session metadata is not retained in this archive.
// This code is educational, provided without service/FLAC availability guarantees.
// No client/device identity impersonation or authentication bypass is included.
// ============================================================================
// Stable provider indices are reserved to make the historical design understandable.
// Slots 0, 1, 5, 6 and 9 are RETIRED; no reactivation is supported.
const DISCORD_ADDONS = [
  null, // 0: retired
  null, // 1: retired
  null, // 2: no endpoint configured
  null, // 3: no endpoint configured
  null, // 4: no endpoint configured
  null, // 5: retired
  null, // 6: retired
  null, // 7: no endpoint configured
  null, // 8: no endpoint configured
  null, // 9: retired
  null, // 10: no endpoint configured
  null, // 11: no endpoint configured
  null  // 12: no endpoint configured
];
const RETIRED_PROVIDER_INDEXES = new Set([0,1,5,6,9]);
const ROTATING_PROVIDER_INDEXES = new Set([10,11,12]);
function addonEndpointKey(value) {
  return String(value || '').replace(/\/+$/, '').replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
}
function providerUsesChangedManifest(index, resolvedUrl) {
  return !!(index >= 0 && index <= 8 && resolvedUrl &&
    addonEndpointKey(resolvedUrl) !== addonEndpointKey(DISCORD_ADDONS[index]));
}
function configuredAddonUrl(index, env = {}) {
  if (RETIRED_PROVIDER_INDEXES.has(index) || !Number.isInteger(index) || index<0 || index>=DISCORD_ADDONS.length)
    return null;
  // These are placeholders for an educational reference, not an invitation
  // to access third-party systems without authorization.
  if (index <= 8) {
    if (/^(false|0|no|off)$/i.test(String(env?.[`DISCORD_${index}_ENABLED`] ?? '').trim())) return null;
    const raw = String(env?.[`DISCORD_${index}_MANIFEST_URL`] || '').trim();
    if (!raw || raw.length > 900 || !safePublicAudioUrl(raw)) return null;
    try {
      const target = new URL(raw);
      if (target.search || target.hash ||
          (/\.json$/i.test(target.pathname) && !/\/manifest\.json$/i.test(target.pathname))) return null;
      return target.href;
    } catch { return null; }
  }
  if (!ROTATING_PROVIDER_INDEXES.has(index)) return null;
  if (!/^(true|1|yes|on)$/i.test(String(env?.[`DISCORD_${index}_ENABLED`] || '').trim())) return null;
  const raw = String(env?.[`DISCORD_${index}_MANIFEST_URL`] || '').trim();
  const allowedHost = String(env?.[`DISCORD_${index}_ALLOWED_HOST`] || '').trim().toLowerCase();
  if (!raw || raw.length > 900 || !allowedHost || !/^[a-z0-9][a-z0-9.-]{1,250}[a-z0-9]$/.test(allowedHost) ||
      !allowedHost.includes('.') || !safePublicAudioUrl(raw)) return null;
  try {
    const target = new URL(raw);
    if (target.hostname !== allowedHost || target.protocol !== 'https:' ||
        target.username || target.password || target.port || target.search || target.hash ||
        !target.pathname.endsWith('/manifest.json')) return null;
    return target.href;
  } catch { return null; }
}

// Avoid silently replaying a saved native track ID against a replaced source.
// Only changed ordinary provider endpoints receive a short, one-way config
// marker in newly issued track IDs. No manifest URLs or tokens are logged.
// This tag is for stale-ID prevention, not authentication.
const PROVIDER_MANIFEST_TAG_CACHE = new Map();
async function providerManifestTag(index, resolvedUrl) {
  const key = `${index}:${addonEndpointKey(resolvedUrl)}`;
  if (PROVIDER_MANIFEST_TAG_CACHE.has(key)) return PROVIDER_MANIFEST_TAG_CACHE.get(key);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const tag = 'pv_' + Array.from(new Uint8Array(digest).slice(0, 12),
    b => b.toString(16).padStart(2, '0')).join('');
  if (PROVIDER_MANIFEST_TAG_CACHE.size >= 20) PROVIDER_MANIFEST_TAG_CACHE.clear();
  PROVIDER_MANIFEST_TAG_CACHE.set(key, tag);
  return tag;
}

// An opaque tag changes with each renewed Provider 10 manifest. Old session
// track IDs must not silently resolve against a different trial account.
// Only the digest prefix (not the credential URL) is placed in the track ID.
async function soundlinkSessionTag(manifestUrl) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(manifestUrl));
  return 'sl_' + Array.from(new Uint8Array(digest).slice(0, 12),
    b => b.toString(16).padStart(2, '0')).join('');
}
async function rotatingAddonSessionTag(index, manifestUrl) {
  if (index === 10) return soundlinkSessionTag(manifestUrl); // Existing IDs remain valid.
  if (index !== 11 && index !== 12) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(manifestUrl));
  return (index === 11 ? 'lb_' : 'au_') + Array.from(new Uint8Array(digest).slice(0, 12),
    b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// 2. BUILT-IN IMMORTAL FALLBACK SOURCES (No accounts needed)
// ============================================================================
const FALLBACK_SOURCES = {
  SAAVN_API: null, // legacy lossy adapter disabled
  PIPED_API: null, // legacy lossy adapter disabled
  IA_ENABLED: true
};

// OPTIONAL personal FLAC library. Upload legally held .flac files to an R2
// bucket bound as FLAC_BUCKET, and list each track here. Leave [] for free
// public-source-only operation. Objects become streamable via this Worker.
const PERSONAL_FLAC_TRACKS = [
  // { key: "MyMusic/Artist - Song.flac", title: "Song", artist: "Artist", duration: 240 }
];

// Jamendo requires your OWN free client ID; configure Cloudflare variable
// JAMENDO_CLIENT_ID. The read API can be used noncommercially under its terms.
// No Jamendo request is made when it is unset.
// OPTIONAL R2 36-hour read-through cache (v3.7.5): configure a SEPARATE
// private R2 bucket bound as FLAC_CACHE_BUCKET. It must not be public via r2.dev.
// Requires FLAC_CACHE_ENABLED=true, FLAC_CACHE_SIGNING_KEY (32+ random chars),
// and an explicit comma-separated FLAC_CACHE_ALLOWED_PROVIDERS allowlist.
// Only cache audio you are permitted to temporarily copy. Unknown sources are
// never cached by default; example permit after reviewing each file's license:
// FLAC_CACHE_ALLOWED_PROVIDERS=openverse,commons
// Cache uses background R2 writes; a failed/slow write NEVER blocks playback.
// An hourly Cron Trigger runs scheduled() to physically delete expired files.
// Additional no-cost public-source adapters (disabled until explicitly opted in):
// Cloudflare Worker env vars: OPENVERSE_ENABLED=true and/or COMMONS_ENABLED=true.
// No LastWave, TIDAL, Qobuz, or paid account access is added. Anonymous public APIs
// enforce quotas; enabling these sources does not confer permission to distribute
// third-party recordings. Public-source FLAC URL bytes are checked where supported.
// v3.7.6: ATMOS_ENABLED=true is optional. Atmos is served ONLY if the BitChord
// client sends atmos=auto AND an upstream provides actual eac3-joc metadata.
// E-AC-3 JOC is lossy immersive audio, never cached in the 36-hour FLAC R2.
// Stereo FLAC remains the only accepted stream when Atmos mode is off.


// A narrowly scoped search retry for catalogs that index the song title but
// not title+artist text. A shorter query is discovery ONLY; never loosen the
// track identity, duration, edition, codec or FLAC-byte checks at playback.
function simplifiedSearchQuery(query) {
  const raw = String(query || '').trim().replace(/\s+/g, ' ');
  if (raw.length < 9 || raw.length > 150) return null;
  // p11: when the query itself is an exact curated JP/EN display title,
  // spend the one existing simplified retry on its official Japanese/English
  // component. This is discovery, not acceptance of an unrelated recording.
  const bareBilingual = curatedBilingualTitleParts(raw);
  if (bareBilingual) return bareBilingual[0];
  const labeled = raw.match(/^(.{4,100}?)\s+(?:by|[|–—])\s+(.{2,60})$/i);
  let shorter = labeled ? labeled[1].trim() : '';
  // p11: with an explicit title/artist separator, search an official bilingual
  // title using its first curated equivalent component instead of repeating
  // the entire JP/EN display title. Final candidates still undergo matching.
  if (labeled) {
    const officialParts = curatedBilingualTitleParts(shorter);
    if (officialParts) shorter = officialParts[0];
  }
  if (!shorter) {
    const parts = raw.split(' ');
    if (parts.length < 3 || parts.length > 16) return null;
    if (!/[\p{L}\p{N}]/u.test(parts[parts.length - 1]) ||
        /^(?:mix|edit|version|remix|instrumental|live|original|extended|feat|ft|radio|remaster)$/i.test(parts[parts.length - 1])) return null;
    shorter = parts.slice(0, -1).join(' ');
  }
  // Never reduce a query to a single ambiguous word.
  // p8: CJK titles are often a single unspaced token. Only permit this
  // exception when an explicit title/artist separator was supplied.
  const cjkLabeledTitle = Boolean(labeled && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(shorter));
  if ((!cjkLabeledTitle && normalizeName(shorter).split(' ').filter(Boolean).length < 2) ||
      normalizeName(shorter) === normalizeName(raw)) return null;
  return shorter;
}
function simplifiedResultMatchesOriginal(track, originalQuery) {
  const meta = trackMetadata(track);
  if (!meta) return false;
  // "by" or a vertical bar separates title and artist: it is NOT a token
  // that should have to occur in upstream metadata. Preserve an exact two-
  // field check, including for unspaced Japanese, Korean or Chinese titles.
  const labeled = String(originalQuery || '').trim().match(/^(.{4,100}?)\s+(?:by|[|–—])\s+(.{2,60})$/i);
  const bareBilingual = curatedBilingualTitleParts(originalQuery);
  if (bareBilingual) {
    const wanted = new Set(titleVariants(originalQuery));
    return editionTags(originalQuery) === editionTags(meta.title) &&
      titleVariants(meta.title).some(part => wanted.has(part));
  }
  if (labeled) {
    // A title-only retry may return the Japanese half of a curated bilingual
    // title. Apply the SAME conservative recording identity rules as playback
    // rather than requiring literal text equality or accepting arbitrary CJK.
    return recordingMatchDecision({ title: labeled[1], artist: labeled[2] }, meta).ok;
  }
  const terms = [...new Set(normalizeName(originalQuery).split(' ').filter(Boolean))];
  if (terms.length < 3) return false;
  const found = new Set(normalizeName(`${meta.title} ${meta.artist}`).split(' ').filter(Boolean));
  // Exact token coverage is only discovery validation, never playback proof.
  return terms.every(term => found.has(term));
}

// ============================================================================
// 3. YOUR MASTER MANIFEST
// ============================================================================
// FLAC-only by default; Dolby Atmos requires an explicit, opt-in client hint.
// Even in Atmos mode, no arbitrary AAC/MP3/Opus fallback is permitted.
const LOSSLESS_ONLY = true;
// Bound cross-provider work and avoid exhausting provider rate limits.
const MAX_FALLBACK_STREAMS = 3;
const METADATA_MARKER = "~bcflac1~"; // Read both v3.5 and v3.6 IDs.
const STREAM_TIMEOUT_MS = 3200;
const SEARCH_TIMEOUT_MS = 4000;
// Fast search launches known-working providers first and starts additional
// providers only when the initial results are thin. Whole request is bounded.
const SEARCH_INITIAL_WAIT_MS = 1050;
const SEARCH_TOTAL_BUDGET_MS = 4800;
// Only EMPTY multiword searches may use one additional simplified query.
// The extra 450 ms is conditional; normal searches retain the previous budget.
const SEARCH_EMPTY_FALLBACK_EXTRA_MS = 450;
const SEARCH_SIMPLIFIED_TIMEOUT_MS = 1250;
const SEARCH_TARGET_RESULTS = 10;
// Do not let large catalogs with no verified stream evidence prematurely stop
// discovery of potentially playable FLAC recordings. This is a SEARCH prior,
// not a claim that any individual result contains FLAC audio.
const SEARCH_TRUSTED_RESULT_TARGET = 3;
// Observed Nov 3: Provider 8 returned consistent verified FLAC handoffs.
// This is a discovery prior, never proof that any returned candidate is FLAC.
const HISTORICALLY_VERIFIED_PROVIDERS = new Set([8]);
// Lead with the three sources that returned the most useful catalog results
// in the sample; leave unreliable sources to the bounded secondary stage.
// p9: open secondary sources in small waves, not all remaining sources
// after the first 1.05 seconds. Late waves run only when results remain thin.
const SEARCH_PRIMARY_COUNT = 2;
const SEARCH_SECONDARY_BATCH_SIZE = 2;
const SEARCH_THIRD_WAVE_AT_MS = 2450;
const SEARCH_FOURTH_WAVE_AT_MS = 3550;
const SEARCH_SECONDARY_TIMEOUT_MS = 3000;
const RESCUE_SEARCH_TIMEOUT_MS = 2400;
// Includes primary resolution; reserve a useful rescue window after it.
const MAX_RESCUE_DURATION_MS = 9500;
const PRIMARY_RESOLUTION_BUDGET_MS = 3500;
// Strict FLAC checks get a modest extra window based on the October 26 logs:
// previously the 1s probe missed valid files that succeeded on a later try.
// Optional setting: FLAC_PROBE_TIMEOUT_MS (900..2200, default 1600).
// Failed/inconclusive checks never become proof of lossy audio.
const DEFAULT_FLAC_PROBE_TIMEOUT_MS = 1600;
const MAX_RESCUE_TOTAL_CANDIDATES = 5;
function flacProbeTimeoutMs(env = {}) {
  const configured = Number(env?.FLAC_PROBE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.max(900, Math.min(2200, Math.round(configured)))
    : DEFAULT_FLAC_PROBE_TIMEOUT_MS;
}
// v3.7.8: Strict FLAC proof is required, but inconclusive network probes
// never mark a recording permanently bad.
// v3.7.7: Strict default: require FLAC-byte proof for all external addons.
// FLAC_VERIFY_MODE=strict (default) | adaptive | off. Strict may skip a
// genuine FLAC if the source blocks probes; adaptive is metadata-based when inconclusive.
const FLAC_PROBE_CACHE = new Map();
const MAX_FLAC_PROBE_CACHE = 350;
const MAX_RESULT_ALTERNATIVES = 5;
// The search route permits IDs up to 1900 characters. Allow the same
// encoded-metadata envelope to be decoded at playback, including 5 alternates.
const MAX_ENCODED_TRACK_METADATA_LENGTH = 1900;
const NEW_SOURCE_TIMEOUT_MS = 2800;
// October 25 sample: providers 1 and 4 resolved otherwise failed FLAC tracks.
// These are preferences, not permanent bans; indices must never be renumbered.
// v3.7.10: Starting order is based on VERIFIED FLAC playback resolution in
// the October 27 anonymized Worker sample, not unverified search badges.
// Historical (before endpoint refresh): provider 1 had 15 successful handoffs,
// provider 4 had 4. Endpoint URLs at indexes 1, 3, and 8 have since been
// updated; their observed health starts fresh per Worker isolate. Indexes 3
// and 8 are in the initial exploration cohort, not declared verified winners.
// NEVER reorder DISCORD_ADDONS itself:
// saved BitChord IDs encode the original discord_N position; indexes 5, 6, 9
// include retired discord_0; Provider 7 remains discord_7; Provider 8 remains discord_8;
// Provider 10 remains discord_10; Provider 11 remains discord_11.
// October 29 log sample: discord_4 delivered 12 verified FLAC handoffs;
// discord_8 supplied search results but has not yet confirmed audio playback.
// discord_1 (Retired provider 1) is now permanently retired. Other sources may still
// recover from temporary errors; these are priors, not permanent exclusions.
// Keep the temporary Provider 10 trial out of the first search wave until it
// has demonstrated at least one byte-verified FLAC handoff. Its three-hour
// expiry must never crowd out stable sources when the credential expires.
// November 1 sampled logs: discord_0 formerly achieved 8 verified handoffs,
// but its endpoint is now retired, so it must not be ranked or contacted.
// Historical discord_4 successes remain a useful prior; discord_8 search
// badges alone are not FLAC proof. Rank adapts without changing provider IDs.
// p9 priors prefer repeatedly verified audio, then searchable providers.
// Runtime success/failure still adapts, and disabled sources stay disabled.
// IDs / DISCORD_ADDONS positions are deliberately unchanged.
const PREFERRED_PROVIDERS = [8, 3, 10, 11, 4, 7, 2];
const PROVIDER_COOLDOWNS = new Map(); // best-effort per Worker isolate
const PROVIDER_FAILURE_STREAKS = new Map(); // best-effort per Worker isolate
// No shared Durable Object reads in the hot search or playback paths.
// Privacy-safe, per-isolate observations of rotating provider phases only.
// Never store URLs, session tokens, native IDs, headers, or track titles.
const ROTATING_PROVIDER_DIAGNOSTICS = new Map();
function rotatingProviderDiagnostic(index, stage, outcome, status = 0) {
  if (!ROTATING_PROVIDER_INDEXES.has(index)) return;
  const stageSafe = ['search', 'stream', 'verification'].includes(stage) ? stage : 'other';
  const outcomeSafe = ['results', 'empty', 'confirmed', 'timeout', 'access_denied',
    'rate_limited', 'http_error', 'invalid_json', 'invalid_stream', 'metadata_mismatch',
    'non_flac', 'probe_inconclusive', 'request_error', 'missing_track',
    'access_required', 'unusable_url', 'encrypted_stream', 'atmos_not_requested',
    'explicit_lossy_format', 'unsupported_manifest', 'unsupported_extension'].includes(outcome)
      ? outcome : 'request_error';
  const safeStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
  ROTATING_PROVIDER_DIAGNOSTICS.set(index, {
    stage: stageSafe, outcome: outcomeSafe, http_status: safeStatus || null,
    last_at: new Date().toISOString()
  });
  console.log(`[ROTATING SOURCE] provider=discord_${index} stage=${stageSafe} outcome=${outcomeSafe} http_status=${safeStatus || 'none'}`);
}
function rotatingErrorOutcome(status) {
  return status === 504 ? 'timeout' : status === 402 ? 'access_required' : status === 401 || status === 403 ? 'access_denied'
    : status === 429 ? 'rate_limited' : status === 404 || status === 410
      ? 'missing_track' : status >= 400 ? 'http_error' : 'request_error';
}
// v3.7.3: short, per-isolate negative cache. It prevents the same nonexistent
// native stream ID being requested repeatedly, without banning its artist.
// Neither cached entries nor logs contain resolved URLs or credentials.
const STREAM_NEGATIVE_CACHE = new Map();
const STREAM_HEALTH = new Map(); // per-isolate VERIFIED resolution success, missing tracks, upstream errors, latency
const SEARCH_HEALTH = new Map(); // per-isolate search response health; weaker evidence than verified FLAC
const MAX_NEGATIVE_CACHE_ENTRIES = 400;
function trackFailureKey(index, nativeId, mode = "flac") { return `${index}:${nativeId}:${mode}`; }
function streamRecentlyFailed(index, nativeId, mode = "flac") {
  const key = trackFailureKey(index, nativeId, mode);
  const expires = STREAM_NEGATIVE_CACHE.get(key) || 0;
  if (expires > Date.now()) return true;
  if (expires) STREAM_NEGATIVE_CACHE.delete(key);
  return false;
}
function markStreamFailure(index, nativeId, status, mode = "flac") {
  const ttl = status === 404 ? 90000 : status === 410 ? 120000
    : status === 429 ? 20000 : status === 504 ? 10000
    : status === 502 || status === 503 ? 20000 : status === 415 ? 60000 : 0;
  if (!ttl) return;
  const now = Date.now();
  if (STREAM_NEGATIVE_CACHE.size >= MAX_NEGATIVE_CACHE_ENTRIES) {
    for (const [key, expiry] of STREAM_NEGATIVE_CACHE) {
      if (expiry <= now) STREAM_NEGATIVE_CACHE.delete(key);
    }
    // FIFO eviction, bounded across a long-lived isolate.
    while (STREAM_NEGATIVE_CACHE.size >= MAX_NEGATIVE_CACHE_ENTRIES) {
      STREAM_NEGATIVE_CACHE.delete(STREAM_NEGATIVE_CACHE.keys().next().value);
    }
  }
  STREAM_NEGATIVE_CACHE.set(trackFailureKey(index, nativeId, mode), now + ttl);
}
// Only a successfully verified FLAC stream counts as a provider success.
// 404/410 indicate track availability, not an outage. They gently reduce
// preferred ranking, without creating a provider-wide cooldown.
function observeStreamHealth(index, success, status = 0, latencyMs = 0) {
  const item = STREAM_HEALTH.get(index) || { ok: 0, failed: 0, missing: 0, unverified: 0, latencyMs: 0 };
  if (success) item.ok += 1;
  else if (status === 404 || status === 410) item.missing += 1;
  else if (status === -1) item.unverified += 1; // inconclusive verification, not a known wrong codec
  else if (status) item.failed += 1;
  if (item.ok + item.failed + item.missing + item.unverified > 48) {
    item.ok = Math.ceil(item.ok / 2);
    item.failed = Math.ceil(item.failed / 2);
    item.missing = Math.ceil(item.missing / 2);
    item.unverified = Math.ceil(item.unverified / 2);
  }
  // Latency means VERIFIED stream readiness, not a fast-but-dead search.
  if (success && Number.isFinite(latencyMs) && latencyMs > 0) {
    item.latencyMs = item.latencyMs > 0
      ? Math.round(item.latencyMs * 0.7 + latencyMs * 0.3)
      : Math.round(latencyMs);
  }
  STREAM_HEALTH.set(index, item);
}
function observeSearchHealth(index, success, latencyMs = 0) {
  const item = SEARCH_HEALTH.get(index) || { ok: 0, failed: 0, latencyMs: 0 };
  if (success) item.ok += 1;
  else item.failed += 1;
  if (item.ok + item.failed > 32) {
    item.ok = Math.ceil(item.ok / 2);
    item.failed = Math.ceil(item.failed / 2);
  }
  if (success && Number.isFinite(latencyMs) && latencyMs > 0) {
    item.latencyMs = item.latencyMs > 0
      ? Math.round(item.latencyMs * 0.75 + latencyMs * 0.25)
      : Math.round(latencyMs);
  }
  SEARCH_HEALTH.set(index, item);
}
// Higher means better. Priorities are deliberately close enough that repeated
// verified performance can change the order, but a single lucky result cannot.
function providerPriorityScore(index) {
  const seed = PREFERRED_PROVIDERS.indexOf(index);
  const prior = seed < 0 ? 2 : 37 - seed * 4; // seed order: 37,33,29...5
  const audio = STREAM_HEALTH.get(index);
  const search = SEARCH_HEALTH.get(index);
  let score = prior;
  if (audio) {
    const evidence = audio.ok + audio.failed + audio.missing * 0.4 + audio.unverified * 0.7;
    if (evidence > 0) {
      const posterior = (audio.ok + 1) / (evidence + 2);
      score += (posterior - 0.5) * 42 * Math.min(1, evidence / 5);
    }
    if (audio.ok && audio.latencyMs) {
      score += Math.max(-12, Math.min(8, (1250 - audio.latencyMs) / 200))
        * Math.min(1, audio.ok / 3);
    }
  }
  if (search) {
    const volume = search.ok + search.failed;
    score -= 8 * (search.failed / (volume + 2)) * Math.min(1, volume / 4);
    if (search.ok && search.latencyMs > 1900) score -= Math.min(3, (search.latencyMs - 1900) / 350);
  }
  return Math.round(score * 10) / 10;
}
// One shared ranking function is used for search, results, saved alternatives,
// and fresh discovery. A cooling provider is omitted, not permanently banned.
function preferredRank(index) { return 55 - providerPriorityScore(index); }
// Search 401/403/404/410 usually indicates endpoint access or configuration,
// not a particular song. Give them longer TEMPORARY cooling periods (per isolate).
// Stream 404/410 remains track-specific: never mark a whole provider offline.
const PROVIDER_BAD_FOR_SEARCH_MS = {
  401: 120000, 402: 120000, 403: 120000, 404: 90000, 410: 180000,
  429: 90000, 502: 25000, 503: 25000, 504: 20000
};
function providerCooling(index, operation = "search") {
  const expiry = PROVIDER_COOLDOWNS.get(`${operation}:${index}`) || 0;
  return expiry > Date.now();
}
function noteProviderFailure(index, operation, status) {
  if (!Number.isInteger(index) || status === 499) return; // search cancellation is not an upstream fault
  const base = PROVIDER_BAD_FOR_SEARCH_MS[status] || (status >= 500 ? 15000 : 0);
  // Stream 404/410 means this recording isn't available, not that the entire
  // provider is offline. Rotating providers returning 504 repeatedly receive
  // a longer bounded backoff to reduce ineffective requests and free-plan use.
  if (!base || (operation === "stream" && (status === 404 || status === 410))) return;
  // Repeated 504s often overlap in the same search wave. While the provider
  // is already cooling, do not extend its deadline or log another cooldown.
  // Search-error telemetry still records each upstream failure separately.
  const key = `${operation}:${index}`;
  if (status === 504 && (PROVIDER_COOLDOWNS.get(key) || 0) > Date.now()) return;
  // Unproven providers get a little more time to recover from repeated 504s.
  // Once a provider has delivered verified FLAC, retain the shorter 20s base.
  // No provider is permanently removed, and the backoff is isolate-local.
  const failures = Math.min(5, (PROVIDER_FAILURE_STREAKS.get(key) || 0) + 1);
  PROVIDER_FAILURE_STREAKS.set(key, failures);
  if (status === 504 && failures < 2) return; // a single timeout is not an outage
  // p9: recurring 504/timeout failures get longer, bounded backoff. This is
  // isolate-local and resets on success, so recovering sources re-enter safely.
  // Don't punish already verified FLAC playback based on one search failure.
  const verified = (STREAM_HEALTH.get(index)?.ok || 0) > 0;
  const duration = status === 504
    ? (verified ? [0,0,20000,35000,60000,90000][failures]
      : [0,0,45000,90000,150000,240000][failures])
    : Math.min(600000, base * (failures >= 3 ? 3 : failures >= 2 ? 2 : 1));
  PROVIDER_COOLDOWNS.set(key, Date.now() + duration);
  flacDiagRecord("provider_cooldown", index, status);
  console.warn(`[PROVIDER COOLDOWN] provider=discord_${index} operation=${operation} status=${status} duration_ms=${duration}`);
}
function noteProviderSuccess(index, operation) {
  const key = `${operation}:${index}`;
  PROVIDER_COOLDOWNS.delete(key);
  PROVIDER_FAILURE_STREAKS.delete(key);
}

// v3.7.4 public-source requests are best-effort and deliberately conservative.
// Runtime-local throttles/caches reset across Worker isolates. Cloudflare's edge
// does not provide a globally shared request budget without Durable Objects/KV.
const PUBLIC_CATALOG_STATE = new Map();
const PUBLIC_CATALOG_CACHE = new Map();
function freeSourceEnabled(env, key) {
  return /^(true|1|yes|on)$/i.test(String(env?.[key] || "").trim());
}
function publicSourceBudget(name, minimumIntervalMs, dailyLimit) {
  const today = new Date().toISOString().slice(0, 10);
  const state = PUBLIC_CATALOG_STATE.get(name) || { day: today, used: 0, last: 0, blockedUntil: 0 };
  if (state.day !== today) { state.day = today; state.used = 0; state.last = 0; }
  const now = Date.now();
  if (now < state.blockedUntil || now - state.last < minimumIntervalMs || state.used >= dailyLimit) {
    PUBLIC_CATALOG_STATE.set(name, state);
    return false;
  }
  state.used++; state.last = now;
  PUBLIC_CATALOG_STATE.set(name, state);
  return true;
}
function notePublicSourceError(name, status) {
  if (status !== 429 && status < 500) return;
  const state = PUBLIC_CATALOG_STATE.get(name) || { day: new Date().toISOString().slice(0, 10), used: 0, last: 0, blockedUntil: 0 };
  state.blockedUntil = Date.now() + (status === 429 ? 10 * 60 * 1000 : 60 * 1000);
  PUBLIC_CATALOG_STATE.set(name, state);
  console.warn(`[PUBLIC SOURCE COOLDOWN] source=${name} status=${status}`);
}
function cachedPublicTracks(provider, query) {
  const key = `${provider}:${normalizeName(query)}`;
  const cached = PUBLIC_CATALOG_CACHE.get(key);
  if (!cached) return null;
  if (cached.expiry < Date.now()) { PUBLIC_CATALOG_CACHE.delete(key); return null; }
  return cached.tracks;
}
function cachePublicTracks(provider, query, tracks) {
  const key = `${provider}:${normalizeName(query)}`;
  if (PUBLIC_CATALOG_CACHE.size >= 90) {
    for (const [k, entry] of PUBLIC_CATALOG_CACHE) {
      if (entry.expiry < Date.now()) PUBLIC_CATALOG_CACHE.delete(k);
    }
    while (PUBLIC_CATALOG_CACHE.size >= 90) PUBLIC_CATALOG_CACHE.delete(PUBLIC_CATALOG_CACHE.keys().next().value);
  }
  PUBLIC_CATALOG_CACHE.set(key, { tracks, expiry: Date.now() + (tracks.length ? 120000 : 15000) });
}

// v3.7.17 patch tracking: public manifest version stays fixed for p1, p2...
const PATCH_REVISION = "p11";
const MANIFEST = {
  id: "com.custom.master-aggregator",
  name: "Master Aggregator (FLAC + Anime/Vocaloid, Optional Atmos, 36h Cache)",
  version: "3.7.17",
  resources: ["search", "stream"],
  allowDownloads: 1,
  checkValidLossless: 0,
  atmos: 0
};


// ============================================================================
// HEALTH UI (read-only). No provider rewiring, probes, or third-party research.
// Per-isolate statistics are diagnostic only and reset on isolate restart.
// ============================================================================
const HEALTH_PROVIDER_NAMES = Object.freeze({
  2:'Provider 2', 3:'Provider 3', 4:'Provider 4', 7:'Provider 7',
  8:'Provider 8', 10:'Provider 10', 11:'Provider 11', 12:'Provider 12'
});
// ============================================================================
// FLAC FAILURE DIAGNOSTICS (v3.7.17-p6)
// 60-minute safe event categories. Optional SQLite Durable Object binding
// FLAC_DIAGNOSTICS aggregates across isolates; without it, local counters
// remain available but may be empty on an unrelated Health-page isolate.
// NEVER retain URLs, tracks, IDs, queries, tokens or IPs.
// ============================================================================
const FLAC_DIAG_WINDOW_MINUTES = 60;
const FLAC_DIAG_BUCKETS = new Map();
const FLAC_DIAG_RECENT = [];
const FLAC_DIAG_PENDING = new Map(); // sanitized shared-store deltas only
const FLAC_DIAG_EVENT_NAMES = new Set([
  'search_request','search_results','search_empty','search_simplified',
  'provider_search_start','provider_search_ok','provider_search_error','provider_cooldown',
  'stream_route_hit','stream_preflight_rejected',
  'stream_request','stream_flac_handoff','stream_cached_handoff','stream_atmos_handoff',
  'stream_unavailable','stream_error','probe_confirmed','probe_non_flac',
  'probe_inconclusive','probe_cache','candidate_skip','rescue_start',
  'rescue_success','rescue_exhausted','identity_rejected'
]);
// Failure summaries count evidence events only. Cooldown events are reported
// separately, so a single HTTP 504 is not counted again as a failure merely
// because its provider was put into cooldown. Counts remain event-level, not
// distinct failed songs or distinct upstream HTTP requests.
const FLAC_DIAG_FAILURE_EVENTS = new Set([
  'provider_search_error', 'stream_preflight_rejected', 'stream_error', 'stream_unavailable',
  'probe_non_flac', 'probe_inconclusive', 'candidate_skip',
  'identity_rejected', 'rescue_exhausted'
]);
const FLAC_DIAG_REASONS = new Set([
  'none','confirmed','non_flac','inconclusive','cache',
  'http_401','http_402','http_403','http_404','http_410','http_415',
  'http_422','http_429','http_500','http_502','http_503','http_504',
  'http_other','timeout_or_504','invalid_json','invalid_stream',
  'unsupported_manifest','explicit_lossy_format','metadata_missing',
  'metadata_incompatible','atmos_not_requested','probe_budget_exhausted',
  'title_mismatch','artist_mismatch','version_mismatch','duration_mismatch',
  'rescue_duration_unavailable','no_fresh_match','all_candidates_failed',
  'deadline','providers_cooling','no_verified_stream','no_verified_playable_stream',
  'wrong_recording_identity','stream_error','network_or_probe_error','other',
  'missing_metadata','version_conflict','original_mix_needs_proof',
  'voicebank_conflict','producer_conflict','vocaloid_producer_unverified',
  'album_mismatch','generic_title_ambiguous','artist_or_album_mismatch',
  'probe_timeout','probe_network_error','incomplete_audio_header',
  'missing_audio_body','unusable_url','encrypted_stream','unsupported_extension',
  'bad_encoded_path','missing_provider_separator','invalid_track_id',
  'unsupported_provider','retired_provider','stale_layout',
  'stale_manifest','expired_or_disabled_session',
  'unsafe_or_unsupported_url','non_flac_magic_bytes','upstream_error_document','invalid_probe_range'
]);
const FLAC_DIAG_PROVIDER_IDS = new Set([
  // Keep retired discord_1 in telemetry allowlist for historical 60-min events only.
  'discord_1','discord_2','discord_3','discord_4','discord_7','discord_8',
  'discord_10','discord_11','discord_12','jamendo','ia','personal','openverse','commons','cache'
]);
function flacDiagProvider(provider) {
  const label = typeof provider === 'number' ? `discord_${provider}` : provider;
  return FLAC_DIAG_PROVIDER_IDS.has(label) ? label : 'system';
}
function flacDiagReason(reason) {
  if (FLAC_DIAG_REASONS.has(reason)) return reason;
  if (typeof reason === 'number' && Number.isInteger(reason) && reason >= 400 && reason < 600)
    return FLAC_DIAG_REASONS.has(`http_${reason}`) ? `http_${reason}` : 'http_other';
  // These are category-only translations: never retain raw errors or strings.
  if (reason === 'timeout') return 'timeout_or_504';
  if (typeof reason === 'string' && /^upstream_http_\d{3}$/.test(reason))
    return flacDiagReason(Number(reason.slice(-3)));
  if (reason === 'non_flac_bytes' || reason === 'known_lossy_or_non_audio_type') return 'non_flac';
  if (reason === 'missing_flac_metadata') return 'metadata_missing';
  if (reason === 'metadata_incompatible_or_unsafe') return 'metadata_incompatible';
  if (reason === 'wrong_recording') return 'wrong_recording_identity';
  if (reason === 'non_flac_stream') return 'non_flac';
  if (reason === 'upstream_timeout') return 'timeout_or_504';
  return 'other';
}
function flacDiagRecord(event, provider = 'system', reason = 'none', count = 1) {
  if (!FLAC_DIAG_EVENT_NAMES.has(event)) return;
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const cutoff = minute - FLAC_DIAG_WINDOW_MINUTES + 1;
  for (const key of FLAC_DIAG_BUCKETS.keys()) if (key < cutoff) FLAC_DIAG_BUCKETS.delete(key);
  const safeProvider = flacDiagProvider(provider);
  const safeReason = flacDiagReason(reason);
  const n = Number.isInteger(count) ? Math.max(1, Math.min(1000, count)) : 1;
  let bucket = FLAC_DIAG_BUCKETS.get(minute);
  if (!bucket) {
    bucket = { events: Object.create(null), reasons: Object.create(null), providers: Object.create(null) };
    FLAC_DIAG_BUCKETS.set(minute, bucket);
  }
  bucket.events[event] = (bucket.events[event] || 0) + n;
  // Count only actionable categories, not generic/no-error successes.
  if (FLAC_DIAG_FAILURE_EVENTS.has(event) &&
      !['none', 'confirmed', 'cache'].includes(safeReason))
    bucket.reasons[safeReason] = (bucket.reasons[safeReason] || 0) + n;
  if (safeProvider !== 'system') {
    const providerStats = bucket.providers[safeProvider] ||= Object.create(null);
    providerStats[event] = (providerStats[event] || 0) + n;
    if (event === 'candidate_skip' && safeReason === 'unsupported_manifest')
      providerStats.unsupported_manifest_skips = (providerStats.unsupported_manifest_skips || 0) + n;
    if (event === 'provider_search_error' && safeReason === 'timeout_or_504')
      providerStats.local_search_timeouts = (providerStats.local_search_timeouts || 0) + n;
  }
  // Recent events show one sanitized category per action, not per rejected match.
  if (event !== 'identity_rejected' && event !== 'provider_search_start') {
    FLAC_DIAG_RECENT.push({ at: new Date(now).toISOString(), event, provider: safeProvider, reason: safeReason });
    if (FLAC_DIAG_RECENT.length > 18) FLAC_DIAG_RECENT.splice(0, FLAC_DIAG_RECENT.length - 18);
  }
  // The optional shared Durable Object receives only allowlisted categories,
  // minute timestamps, provider IDs and bounded counts; never request data.
  const pendingKey = `${minute}|${event}|${safeProvider}|${safeReason}`;
  if (!FLAC_DIAG_PENDING.has(pendingKey) && FLAC_DIAG_PENDING.size >= 500)
    FLAC_DIAG_PENDING.delete(FLAC_DIAG_PENDING.keys().next().value);
  const old = FLAC_DIAG_PENDING.get(pendingKey);
  FLAC_DIAG_PENDING.set(pendingKey, {
    m: minute, e: event, p: safeProvider, r: safeReason,
    n: Math.min(1000, (old?.n || 0) + n), at: new Date(now).toISOString()
  });
}
function flacDiagAggregate(buckets, recent, scope) {
  const cutoff = Math.floor(Date.now() / 60000) - FLAC_DIAG_WINDOW_MINUTES + 1;
  const events = Object.create(null), reasons = Object.create(null), providers = Object.create(null);
  function merge(into, from) {
    for (const [k, n] of Object.entries(from)) into[k] = (into[k] || 0) + n;
  }
  let activeMinutes = 0;
  for (const [minute, bucket] of buckets) {
    if (minute < cutoff) continue;
    activeMinutes++;
    merge(events, bucket.events);
    merge(reasons, bucket.reasons);
    for (const [provider, stats] of Object.entries(bucket.providers))
      merge(providers[provider] ||= Object.create(null), stats);
  }
  const safeRecent = recent.filter(item => Date.parse(item.at) >= cutoff * 60000).slice(-12).reverse();
  return {
    scope, window_minutes: 60,
    active_minutes: activeMinutes,
    counters: {
      search_requests: events.search_request || 0,
      searches_with_results: events.search_results || 0,
      searches_empty: events.search_empty || 0,
      simplified_retries: events.search_simplified || 0,
      stream_route_hits: events.stream_route_hit || 0,
      stream_preflight_rejections: events.stream_preflight_rejected || 0,
      stream_requests: events.stream_request || 0,
      flac_handoffs: events.stream_flac_handoff || 0,
      cached_flac_handoffs: events.stream_cached_handoff || 0,
      atmos_handoffs: events.stream_atmos_handoff || 0,
      stream_unavailable: events.stream_unavailable || 0,
      stream_errors: events.stream_error || 0,
      provider_search_errors: events.provider_search_error || 0,
      confirmed_probes: events.probe_confirmed || 0,
      non_flac_probes: events.probe_non_flac || 0,
      inconclusive_probes: events.probe_inconclusive || 0,
      reused_probes: events.probe_cache || 0,
      rescue_attempts: events.rescue_start || 0,
      rescue_successes: events.rescue_success || 0,
      rescue_exhausted: events.rescue_exhausted || 0,
      rejected_identity_candidates: events.identity_rejected || 0,
      provider_cooldown_events: events.provider_cooldown || 0
    },
    failure_reasons: Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,12)
      .map(([reason,count])=>({reason,count})),
    failure_reason_semantics: 'Failure-related evidence events, excluding cooldown events; counts are not unique songs or requests.', 
    providers: Object.entries(providers).sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([id, c]) => ({ id,
        search_attempts:c.provider_search_start || 0,
        search_failures:c.provider_search_error || 0,
        local_search_timeouts:c.local_search_timeouts || 0,
        unsupported_manifest_skips:c.unsupported_manifest_skips || 0,
        candidate_skips:c.candidate_skip || 0,
        confirmed_probes:c.probe_confirmed || 0,
        non_flac_probes:c.probe_non_flac || 0,
        inconclusive_probes:c.probe_inconclusive || 0,
        flac_handoffs:c.stream_flac_handoff || 0,
        cooldowns:c.provider_cooldown || 0
      })),
    recent_events: safeRecent,
    limitations: [
      scope === 'shared Durable Object across isolates'
        ? 'Shared counters survive isolate restarts and deployments, but writes are best-effort and could be delayed or dropped after a failed upload.'
        : 'Local counters reset on isolate restart; other regions and isolates have separate counters.',
      'A FLAC handoff proves the Worker selected verified FLAC, not that a client played it.',
      'Stream route hits count /stream/ requests before ID checks. Zero route hits despite client upgrade attempts may indicate client-side routing or another addon.',
      'Failure reasons exclude cooldown duplication, but other stages may still each generate an event for the same request.',
      'local_search_timeouts records Worker-side deadline failures; upstream HTTP 504 responses remain in http_504. These are events, not unique songs.',
      'Unsupported manifest counts indicate rejected playlist formats; no DASH/HLS decoding was added.',
      'Counts track events, probes and requests; do not treat probe counts as unique songs.',
      'No song metadata, user searches, media URLs, tokens, or IP addresses are retained.'
    ]
  };
}


function flacDiagSnapshot() {
  const cutoff = Math.floor(Date.now() / 60000) - FLAC_DIAG_WINDOW_MINUTES + 1;
  for (const minute of FLAC_DIAG_BUCKETS.keys())
    if (minute < cutoff) FLAC_DIAG_BUCKETS.delete(minute);
  return flacDiagAggregate(FLAC_DIAG_BUCKETS, FLAC_DIAG_RECENT,
    'rolling 60 minutes / current Worker isolate only');
}

function flacDiagStub(env) {
  const binding = env?.FLAC_DIAGNOSTICS;
  if (!binding || typeof binding.idFromName !== 'function' || typeof binding.get !== 'function') return null;
  return binding.get(binding.idFromName('bitchord-flac-diagnostics-v1'));
}

// Nonblocking telemetry. Upload one consolidated batch after each Worker
// request; this never runs in the critical search/stream response path.
async function flacDiagFlush(env) {
  const stub = flacDiagStub(env);
  if (!stub || !FLAC_DIAG_PENDING.size) return;
  const entries = Array.from(FLAC_DIAG_PENDING.values());
  FLAC_DIAG_PENDING.clear();
  try {
    const reply = await stub.fetch('https://diagnostics.invalid/ingest', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({entries})
    });
    if (!reply.ok) throw new Error('shared_store_unavailable');
  } catch {
    // Bounded best-effort retry: future activity can retry these counters.
    // Avoid unhandled exceptions or blocking FLAC playback.
    for (const entry of entries) {
      const key = `${entry.m}|${entry.e}|${entry.p}|${entry.r}`;
      const previous = FLAC_DIAG_PENDING.get(key);
      if (FLAC_DIAG_PENDING.size >= 500 && !previous)
        FLAC_DIAG_PENDING.delete(FLAC_DIAG_PENDING.keys().next().value);
      FLAC_DIAG_PENDING.set(key, {...entry, n: Math.min(1000, entry.n + (previous?.n || 0))});
    }
    console.warn('[FLAC DIAGNOSTICS] shared_store_write_unavailable; local_fallback=true');
  }
}

async function flacDiagRead(env) {
  const stub = flacDiagStub(env);
  if (stub) {
    try {
      const reply = await stub.fetch('https://diagnostics.invalid/snapshot');
      if (!reply.ok) throw new Error('shared_store_unavailable');
      const data = await reply.json();
      if (data?.counters && Array.isArray(data?.providers) && Array.isArray(data?.recent_events)) {
        data.storage_mode = 'shared_durable_object';
        return data;
      }
    } catch {
      console.warn('[FLAC DIAGNOSTICS] shared_store_read_unavailable; local_fallback=true');
    }
  }
  return {
    ...flacDiagSnapshot(), storage_mode: 'local_isolate',
    storage_notice: stub
      ? 'Shared Durable Object unavailable; showing only this Worker isolate.'
      : 'Shared diagnostics binding FLAC_DIAGNOSTICS is missing. Local counters may be empty because playback and /health use different isolates.'
  };
}

// SQLite-backed Durable Object. Not exposed as a public Worker URL.
// Uses diag-v5 for p11 to separate the new bilingual-title matching metrics
// from p9/p10 rolling counters (diag-v4). Historic diagnostic snapshots remain
// untouched. Counters restart without deleting any old shared storage.
// This single named instance aggregates sanitized counters across edge isolates.
export class BitChordDiagnosticsDO {
  constructor(state, env) { this.state = state; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/snapshot' && request.method === 'GET') {
      const current = await this.state.storage.get('diag-v5') || {buckets:{},recent:[]};
      return Response.json(flacDiagAggregate(
        Object.entries(current.buckets || {}).map(([m,b])=>[Number(m),b]),
        Array.isArray(current.recent) ? current.recent : [],
        'shared Durable Object across isolates'));
    }
    if (path !== '/ingest' || request.method !== 'POST')
      return new Response(null, {status:404});
    const body = await request.text();
    if (body.length > 120000) return new Response(null,{status:413});
    let incoming;
    try { incoming = JSON.parse(body)?.entries; } catch { return new Response(null,{status:400}); }
    if (!Array.isArray(incoming) || incoming.length > 500) return new Response(null,{status:400});
    const cutoff = Math.floor(Date.now()/60000) - FLAC_DIAG_WINDOW_MINUTES + 1;
    await this.state.storage.transaction(async (txn) => {
      const current = await txn.get('diag-v5') || {buckets:{},recent:[]};
      const buckets = current.buckets || {};
      const recent = Array.isArray(current.recent) ? current.recent : [];
      for (const m of Object.keys(buckets)) if (Number(m)<cutoff) delete buckets[m];
      for (const item of incoming) {
        if (!item || !Number.isInteger(item.m) || item.m < cutoff || item.m > cutoff+60 ||
            !FLAC_DIAG_EVENT_NAMES.has(item.e) ||
            typeof item.p !== 'string' || flacDiagProvider(item.p) !== item.p ||
            typeof item.r !== 'string' || flacDiagReason(item.r) !== item.r ||
            !Number.isInteger(item.n) || item.n < 1 || item.n > 1000) continue;
        const bucket = buckets[item.m] ||= {events:{}, reasons:{}, providers:{}};
        bucket.events[item.e] = (bucket.events[item.e] || 0) + item.n;
        if (FLAC_DIAG_FAILURE_EVENTS.has(item.e) &&
            !['none', 'confirmed', 'cache'].includes(item.r))
          bucket.reasons[item.r] = (bucket.reasons[item.r] || 0) + item.n;
        if (item.p !== 'system') {
          const ps = bucket.providers[item.p] ||= {};
          ps[item.e] = (ps[item.e] || 0) + item.n;
          if (item.e === 'candidate_skip' && item.r === 'unsupported_manifest')
            ps.unsupported_manifest_skips = (ps.unsupported_manifest_skips || 0) + item.n;
          if (item.e === 'provider_search_error' && item.r === 'timeout_or_504')
            ps.local_search_timeouts = (ps.local_search_timeouts || 0) + item.n;
        }
        if (item.e !== 'identity_rejected' && item.e !== 'provider_search_start') {
          // Date/time is reconstituted from sanitized input minute rather than
          // trusting arbitrary upstream timestamps or preserving user metadata.
          recent.push({at:new Date(item.m*60000).toISOString(),event:item.e,provider:item.p,reason:item.r});
        }
      }
      current.buckets = buckets;
      current.recent = recent.filter(e=>Date.parse(e.at)>=cutoff*60000).slice(-18);
      await txn.put('diag-v5', current);
    });
    return Response.json({ok:true});
  }
}

function healthDashboardSnapshot(env = {}) {
  // Hide permanently retired/reserved provider indexes from dashboard/JSON.
  const sources = DISCORD_ADDONS.map((url, index) => {
    if (RETIRED_PROVIDER_INDEXES.has(index)) return null;
    const configured = !!(typeof configuredAddonUrl === "function"
      ? configuredAddonUrl(index, env) : url);
    const stream = STREAM_HEALTH.get(index) || {};
    const search = SEARCH_HEALTH.get(index) || {};
    const rotating = ROTATING_PROVIDER_DIAGNOSTICS.get(index) || null;
    const state = !configured ? 'disabled' :
      providerCooling(index, 'stream') || providerCooling(index, 'search') ? 'cooldown' :
      stream.ok ? 'flac_resolved' : stream.failed || search.failed ? 'degraded' : 'awaiting_activity';
    return {
      id: `discord_${index}`, name: HEALTH_PROVIDER_NAMES[index] || `Provider ${index}`,
      configured, state,
      priority_score: configured ? providerPriorityScore(index) : null,
      flac_resolutions: stream.ok || 0,
      average_resolution_ms: stream.latencyMs || null,
      failed_stream_attempts: stream.failed || 0,
      missing_tracks: stream.missing || 0,
      inconclusive_probes: stream.unverified || 0,
      searches: search.ok || 0,
      search_errors: search.failed || 0,
      // Each label is an allowlisted category. These metrics are passive only.
      last_rotating_stage: rotating?.stage || null,
      last_rotating_outcome: rotating?.outcome || null,
      last_rotating_http_status: rotating?.http_status || null,
      last_rotating_at: rotating?.last_at || null
    };
  }).filter(Boolean).sort((a, b) => Number(b.configured) - Number(a.configured) ||
      (b.priority_score ?? -999) - (a.priority_score ?? -999));
  return {
    application: 'BitChord Health', version: MANIFEST.version, patch_revision: PATCH_REVISION,
    generated_at: new Date().toISOString(),
    measurement_scope: 'single Worker isolate, passive observations only',
    flac_diagnostics: flacDiagSnapshot(),
    diagnostic_hints: [
      'HTTP 1027 means Cloudflare Workers free daily request limit; 1102 means CPU or memory limits.',
      'A working manifest/health page does not prove upstream FLAC availability.',
      'Expired Provider 10/Provider 11 sessions require a fresh BitChord search after secret rotation.',
      'A FLAC handoff confirms codec signature, not actual client playback.',
      'Rotating-source diagnostics show only the last observed stage and outcome, not a live availability test.'
    ],
    sources
  };
}
function healthEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
// ============================================================================
// OPTIONAL CLOUDFLARE RESOURCE METRICS (read-only, dashboard requests ONLY)
// Workers do not expose host CPU/RAM/disk % from their runtime. Values below
// come from Cloudflare Analytics and account-wide R2 metrics when authorized.
// No API token, provider URL, track ID, account ID or IP appears in the output.
// Results are per-isolate cached for 5 minutes to minimize Analytics API calls.
// ============================================================================
const HEALTH_RESOURCE_CACHE = { expires: 0, key: '', data: null, pending: null };
function healthNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function healthPercent(numerator, denominator) {
  return numerator !== null && denominator !== null && denominator > 0
    ? Math.round(numerator / denominator * 1000) / 10 : null;
}
function healthResourceDefault() {
  return {
    status: 'not_configured', measured_at: null, window_minutes: 30,
    cpu: { status: 'unavailable', percent: null, p50_ms: null, p99_ms: null, budget_ms: null,
      meaning: 'P50 CPU time per request / manually configured per-request CPU budget; not CPU utilization' },
    ram: { status: 'unavailable', percent: null, p50_mb: null, p99_mb: null, limit_mb: 128,
      meaning: 'P50 V8 isolate memory / Cloudflare 128 MB isolate limit; not machine-wide RAM' },
    disk: { status: 'unavailable', percent: null, used_gib: null, budget_gib: null,
      meaning: 'Account-wide R2 published storage / optional user budget; not a Worker filesystem' }
  };
}
async function healthApiJson(address, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const res = await fetch(address, { ...options, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
  finally { clearTimeout(timer); }
}
async function healthResourceMetrics(env = {}) {
  const empty = healthResourceDefault();
  if (!freeSourceEnabled(env, 'HEALTH_RESOURCE_METRICS_ENABLED')) return empty;
  const accountId = String(env?.HEALTH_CF_ACCOUNT_ID || '').trim();
  const scriptName = String(env?.HEALTH_CF_WORKER_NAME || '').trim();
  const apiToken = String(env?.HEALTH_CF_API_TOKEN || '').trim();
  const r2Token = String(env?.HEALTH_R2_API_TOKEN || '').trim();
  const cpuBudget = healthNum(env?.HEALTH_CPU_BUDGET_MS);
  const diskBudgetGib = healthNum(env?.HEALTH_R2_BUDGET_GIB);
  empty.cpu.budget_ms = cpuBudget && cpuBudget > 0 ? cpuBudget : null;
  empty.disk.budget_gib = diskBudgetGib && diskBudgetGib > 0 ? diskBudgetGib : null;
  // Avoid external API calls on malformed or incomplete configuration.
  if (!/^[a-f0-9]{32}$/i.test(accountId) ||
      !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(scriptName) ||
      !apiToken || apiToken.length > 256) return empty;

  // Token never appears in cache identifiers or diagnostic logs.
  const cacheKey = [accountId, scriptName, cpuBudget, diskBudgetGib,
    freeSourceEnabled(env, 'HEALTH_R2_METRICS_ENABLED') && Boolean(r2Token)].join(':');
  if (HEALTH_RESOURCE_CACHE.data && HEALTH_RESOURCE_CACHE.key === cacheKey &&
      HEALTH_RESOURCE_CACHE.expires > Date.now()) return HEALTH_RESOURCE_CACHE.data;
  if (HEALTH_RESOURCE_CACHE.pending && HEALTH_RESOURCE_CACHE.key === cacheKey)
    return HEALTH_RESOURCE_CACHE.pending;
  HEALTH_RESOURCE_CACHE.key = cacheKey;
  const load = async () => {
    const result = healthResourceDefault();
    result.status = 'unavailable';
    result.cpu.budget_ms = empty.cpu.budget_ms;
    result.disk.budget_gib = empty.disk.budget_gib;
    result.measured_at = new Date().toISOString();
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 60 * 1000);
    const headers = { 'Authorization': `Bearer ${apiToken}`, 'Accept': 'application/json' };
    // GraphQL cpuTimeP50/P99 are in MICROSECONDS, memoryUsageBytes in bytes.
    // Query is restricted to THIS Worker script, not account-wide invocations.
    const filter = `scriptName: ${JSON.stringify(scriptName)}, datetime_geq: ${JSON.stringify(start.toISOString())}, datetime_leq: ${JSON.stringify(end.toISOString())}`;
    async function queryWorkers(includeMemory) {
      const memoryFields = includeMemory ? 'memoryUsageBytesP50 memoryUsageBytesP99' : '';
      const query = `query { viewer { accounts(filter: {accountTag: ${JSON.stringify(accountId)}}) { workersInvocationsAdaptive(limit: 1, filter: {${filter}}) { sum {requests errors} quantiles {cpuTimeP50 cpuTimeP99 ${memoryFields}} } } } }`;
      return healthApiJson('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST', headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({query})
      });
    }
    const enableR2 = freeSourceEnabled(env, 'HEALTH_R2_METRICS_ENABLED') &&
      r2Token.length > 0 && r2Token.length <= 256;
    const [workerQuery, r2Query] = await Promise.all([
      queryWorkers(true),
      enableR2 ? healthApiJson(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/metrics`, {
        headers: {'Authorization': `Bearer ${r2Token}`, 'Accept': 'application/json'}
      }) : Promise.resolve(null)
    ]);
    let workerData = workerQuery;
    // Some accounts may not expose the memory quantiles. Preserve CPU readings.
    if (workerData?.errors?.some(e => /memoryUsageBytes/i.test(String(e?.message || '')))) {
      workerData = await queryWorkers(false);
    }
    if (!workerData?.errors?.length) {
      const groups = workerData?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
      // An empty array means no metric samples, not 0% resource consumption.
      if (Array.isArray(groups) && groups.length && healthNum(groups[0]?.sum?.requests) > 0) {
        const q = groups[0].quantiles || {};
        const cpuUs = healthNum(q.cpuTimeP50);
        const cpuP99Us = healthNum(q.cpuTimeP99);
        if (cpuUs !== null) {
          result.cpu.p50_ms = Math.round(cpuUs) / 1000;
          result.cpu.p99_ms = cpuP99Us === null ? null : Math.round(cpuP99Us) / 1000;
          result.cpu.percent = healthPercent(result.cpu.p50_ms, result.cpu.budget_ms);
          result.cpu.status = 'available';
        }
        const ramBytes = healthNum(q.memoryUsageBytesP50);
        const ramP99Bytes = healthNum(q.memoryUsageBytesP99);
        if (ramBytes !== null) {
          result.ram.p50_mb = Math.round(ramBytes / 1000000 * 100) / 100;
          result.ram.p99_mb = ramP99Bytes === null ? null : Math.round(ramP99Bytes / 1000000 * 100) / 100;
          result.ram.percent = healthPercent(ramBytes, 128 * 1000000);
          result.ram.status = 'available';
        }
      }
    }
    if (enableR2 && r2Query?.success !== false && r2Query?.result &&
      ['standard', 'infrequentAccess'].some(t =>
        healthNum(r2Query.result[t]?.published?.payloadSize) !== null ||
        healthNum(r2Query.result[t]?.published?.metadataSize) !== null)) {
      const totalBytes = ['standard', 'infrequentAccess'].reduce((total, tier) => {
        const published = r2Query.result?.[tier]?.published;
        return total + (healthNum(published?.payloadSize) || 0) + (healthNum(published?.metadataSize) || 0);
      }, 0);
      result.disk.used_gib = Math.round(totalBytes / 1073741824 * 1000) / 1000;
      result.disk.percent = healthPercent(totalBytes, result.disk.budget_gib === null ? null : result.disk.budget_gib * 1073741824);
      result.disk.status = 'available';
    }
    result.status = result.cpu.status === 'available' || result.ram.status === 'available' || result.disk.status === 'available'
      ? 'available' : 'unavailable';
    return result;
  };
  const pending = load();
  HEALTH_RESOURCE_CACHE.pending = pending;
  try {
    const value = await pending;
    HEALTH_RESOURCE_CACHE.data = value;
    HEALTH_RESOURCE_CACHE.expires = Date.now() + (value.status === 'available' ? 300000 : 60000);
    return value;
  } finally {
    if (HEALTH_RESOURCE_CACHE.pending === pending) HEALTH_RESOURCE_CACHE.pending = null;
  }
}
function healthResourceCard(label, metric, detail, icon) {
  const percent = metric?.percent;
  const percentText = percent === null || percent === undefined ? 'N/A' : `${healthEscape(percent.toFixed(1))}%`;
  const width = percent === null || percent === undefined ? 0 : Math.max(0, Math.min(100, percent));
  const color = percent === null ? '#697e95' : percent >= 90 ? '#f17d7d' : percent >= 70 ? '#f8bf72' : '#65d4b2';
  return `<section class="meter"><div class="meter-label"><span>${icon} ${healthEscape(label)}</span><strong>${percentText}</strong></div>
    <div class="meter-track"><div class="meter-fill" style="width:${width}%;background:${color}"></div></div>
    <small>${healthEscape(detail)}</small></section>`;
}
async function healthDashboardResponse(url, env) {
  if (!freeSourceEnabled(env, 'HEALTH_DASHBOARD_ENABLED'))
    return Response.json({error: "health_dashboard_disabled", action: "Set HEALTH_DASHBOARD_ENABLED=true and deploy."},
      {status:404, headers:{"Cache-Control":"private, no-store"}});
  const snapshot = healthDashboardSnapshot(env);
  const [diag, resources] = await Promise.all([flacDiagRead(env), healthResourceMetrics(env)]);
  snapshot.flac_diagnostics = diag;
  snapshot.resources = resources;
  const jsonMode = url.searchParams.get('format') === 'json';
  const diagnosticsOnly = url.searchParams.get('format') === 'diagnostics';
  const responseHeaders = {
    'Content-Type': (jsonMode || diagnosticsOnly) ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  };
  if (jsonMode) return new Response(JSON.stringify(snapshot, null, 2),
    {status:200, headers:responseHeaders});
  if (diagnosticsOnly) return new Response(JSON.stringify({
    version: snapshot.version, patch_revision: snapshot.patch_revision,
    generated_at: snapshot.generated_at, flac_diagnostics: snapshot.flac_diagnostics
  }, null, 2), {status:200, headers:responseHeaders});
  const items = snapshot.sources.map(s => `<tr><td><strong>${healthEscape(s.name)}</strong><small style="display:block;color:#9cb0c6">${healthEscape(s.id)}</small></td>
    <td>${healthEscape(s.state.replaceAll('_',' '))}</td>
    <td>${s.priority_score === null ? '—' : healthEscape(s.priority_score)}</td>
    <td>${healthEscape(s.flac_resolutions)}</td>
    <td>${s.average_resolution_ms === null ? '—' : healthEscape(s.average_resolution_ms)+' ms'}</td>
    <td>${healthEscape(s.failed_stream_attempts)}</td>
    <td>${healthEscape(s.missing_tracks)}</td>
    <td>${s.last_rotating_outcome ? healthEscape(`${s.last_rotating_stage}:${s.last_rotating_outcome}${s.last_rotating_http_status ? ' ('+s.last_rotating_http_status+')' : ''}`) : '—'}</td></tr>`).join('');
  const diagnostic = snapshot.flac_diagnostics;
  const diagnosticCounters = diagnostic.counters;
  const diagnosticCards = [
    ['FLAC handoffs', diagnosticCounters.flac_handoffs + diagnosticCounters.cached_flac_handoffs],
    ['Unavailable', diagnosticCounters.stream_unavailable],
    ['Inconclusive probes', diagnosticCounters.inconclusive_probes],
    ['Provider cooldowns', diagnosticCounters.provider_cooldown_events]
  ].map(([label, value]) => `<div class="card"><span>${healthEscape(label)}</span><strong>${healthEscape(value)}</strong></div>`).join('');
  const reasonRows = diagnostic.failure_reasons.length
    ? diagnostic.failure_reasons.map(({reason,count}) => `<tr><td>${healthEscape(reason.replaceAll('_', ' '))}</td><td>${healthEscape(count)}</td></tr>`).join('')
    : '<tr><td colspan="2">No categorized failures observed in this isolate during the last 60 minutes.</td></tr>';
  const diagProviderRows = diagnostic.providers.length
    ? diagnostic.providers.map(s => `<tr><td>${healthEscape(s.id)}</td><td>${healthEscape(s.search_attempts)}</td><td>${healthEscape(s.search_failures)}</td><td>${healthEscape(s.confirmed_probes)}</td><td>${healthEscape(s.non_flac_probes)}</td><td>${healthEscape(s.inconclusive_probes)}</td><td>${healthEscape(s.flac_handoffs)}</td><td>${healthEscape(s.cooldowns)}</td></tr>`).join('')
    : '<tr><td colspan="8">No provider diagnostic activity in this isolate yet.</td></tr>';
  const recentRows = diagnostic.recent_events.length
    ? diagnostic.recent_events.map(e=>`<tr><td>${healthEscape(e.at.slice(11,19))} UTC</td><td>${healthEscape(e.provider)}</td><td>${healthEscape(e.event.replaceAll('_',' '))}</td><td>${healthEscape(e.reason.replaceAll('_',' '))}</td></tr>`).join('')
    : '<tr><td colspan="4">No recent events.</td></tr>';
  const sharedMode = diagnostic.storage_mode === 'shared_durable_object';
  const diagnosticStorageNotice = sharedMode
    ? 'Shared Durable Object · rolling 60-minute counters across Worker instances'
    : (diagnostic.storage_notice || 'Local Worker-instance counters only');
  const diagnosticHtml = `<h2>FLAC Failure Diagnostics</h2>
  <p class="note"><strong>Storage mode:</strong> ${healthEscape(sharedMode ? 'SHARED' : 'LOCAL ONLY')} · ${healthEscape(diagnosticStorageNotice)}</p>
  <p class="note">Passive rolling 60-minute snapshot ${healthEscape(sharedMode ? 'shared across Worker isolates' : 'from this Worker isolate only')}. Refresh to update. Failure categories exclude cooldown duplication but are not unique requests.</p>
  <div class="cards">${diagnosticCards}</div>
  <p class="note">Stream route hits: <strong>${healthEscape(diagnosticCounters.stream_route_hits)}</strong> · Early ID rejections: <strong>${healthEscape(diagnosticCounters.stream_preflight_rejections)}</strong> · Validated stream attempts: <strong>${healthEscape(diagnosticCounters.stream_requests)}</strong> · Searches: <strong>${healthEscape(diagnosticCounters.search_requests)}</strong> · Rescue attempts: <strong>${healthEscape(diagnosticCounters.rescue_attempts)}</strong> · Successful rescues: <strong>${healthEscape(diagnosticCounters.rescue_successes)}</strong> · Explicitly non-FLAC probes: <strong>${healthEscape(diagnosticCounters.non_flac_probes)}</strong></p>
  <p><a href="/health?format=diagnostics">View sanitized diagnostic JSON</a></p>
  <div class="diag-columns"><section><h3>Failure-related event categories</h3><div class="wrap"><table class="compact"><thead><tr><th>Reason</th><th>Evidence events</th></tr></thead><tbody>${reasonRows}</tbody></table></div></section>
  <section><h3>Latest safe events</h3><div class="wrap"><table class="compact"><thead><tr><th>UTC</th><th>Source</th><th>Stage</th><th>Category</th></tr></thead><tbody>${recentRows}</tbody></table></div></section></div>
  <h3>Provider diagnostics (rolling window)</h3><div class="wrap"><table><thead><tr><th>Provider</th><th>Search attempts</th><th>Search errors</th><th>Confirmed FLAC probes</th><th>Non-FLAC probes</th><th>Inconclusive</th><th>FLAC handoffs</th><th>Cooldown events</th></tr></thead><tbody>${diagProviderRows}</tbody></table></div>
  <p class="note">Stream route hits count each request to /stream/ BEFORE ID validation; validated stream attempts count only requests that passed ID and session checks. The counts represent diagnostic events, not unique tracks, distinct timed-out requests, or completed client playback. Cooldowns are shown separately from failure reasons. Missing / invalid saved track IDs can be rejected before stream resolution. The dashboard does not trigger audio-provider requests.</p>`;

  const resource = snapshot.resources;
  const cpuDetail = resource.cpu.p50_ms === null ? 'Analytics unavailable; provide a read-only API token' :
    `P50 ${resource.cpu.p50_ms} ms · P99 ${resource.cpu.p99_ms ?? 'N/A'} ms · budget ${resource.cpu.budget_ms ?? 'unset'} ms/request`;
  const ramDetail = resource.ram.p50_mb === null ? 'Analytics unavailable; V8 isolate limit 128 MB' :
    `P50 ${resource.ram.p50_mb} MB · P99 ${resource.ram.p99_mb ?? 'N/A'} MB · 128 MB isolate limit`;
  const diskDetail = resource.disk.used_gib === null ? 'R2 metrics unavailable; enable optional account-wide storage monitoring' :
    `${resource.disk.used_gib} GiB stored across all account R2 buckets · budget ${resource.disk.budget_gib ?? 'unset'} GiB`;
  const meters = healthResourceCard('CPU budget', resource.cpu, cpuDetail, '⚡') +
    healthResourceCard('RAM', resource.ram, ramDetail, '🧠') +
    healthResourceCard('R2 storage', resource.disk, diskDetail, '💾');
  const active = snapshot.sources.filter(s => s.configured).length;
  const resolved = snapshot.sources.reduce((n,s)=>n+s.flac_resolutions,0);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BitChord Health v${healthEscape(snapshot.version)}</title>
<style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0b1220;color:#edf4fa}
*{box-sizing:border-box}body{margin:0;padding:24px 16px}main{max-width:1000px;margin:auto}
h1{margin-bottom:8px}p{color:#b1c4d4;line-height:1.5}.cards{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}
.card{flex:1;min-width:145px;border:1px solid #354962;background:#152235;border-radius:12px;padding:16px}
.card strong{display:block;font-size:2rem;margin-top:8px}.wrap{overflow:auto;border:1px solid #354962;border-radius:12px}
 .resource-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:16px 0}
.meter{border:1px solid #354962;background:#152235;border-radius:12px;padding:16px}
.meter-label{display:flex;justify-content:space-between;gap:8px;font-size:15px;font-weight:650}
.meter-label strong{font-size:1.3rem}
.meter-track{height:11px;border-radius:999px;background:#30465b;overflow:hidden;margin:15px 0 12px}
.meter-fill{height:100%;border-radius:999px}.meter small{color:#b1c4d4;line-height:1.6}
.note{font-size:13px;color:#b1c4d4}.diag-columns{display:grid;grid-template-columns:1fr 1.4fr;gap:16px}.compact{min-width:0}@media(max-width:760px){.diag-columns{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;min-width:820px}th,td{text-align:left;border-bottom:1px solid #34445b;padding:12px}
th{background:#1c2d42;font-size:13px}td{font-size:13px}a{color:#a3ccff}footer{margin-top:18px;color:#9cb0c6;font-size:12px}
</style></head><body><main><h1>🎧 BitChord Health</h1><p>Read-only Smart Priority monitoring · v${healthEscape(snapshot.version)} (${healthEscape(snapshot.patch_revision)})</p>
<div class="cards"><div class="card">Configured providers<strong>${active}</strong></div>
<div class="card">FLAC resolutions observed<strong>${resolved}</strong></div>
<div class="card">Sources monitored<strong>${snapshot.sources.length}</strong></div></div>
<p><a href="/health">Refresh</a> · <a href="/health?format=json">View JSON</a></p>
<h2>Cloudflare resource monitor</h2>
<p class="note">Rolling 30-minute telemetry, cached up to 5 minutes. CPU means per-request execution budget, not system-wide CPU utilization. RAM is sampled isolate memory. R2 storage is account-wide, not Worker disk.</p>
<div class="resource-grid">${meters}</div>
${diagnosticHtml}
<h2>Provider performance</h2><div class="wrap"><table><thead><tr><th>Provider</th><th>Status</th>
<th>Priority score</th><th>FLAC resolutions</th><th>Avg resolution</th><th>Failures</th><th>Missing</th><th>Rotating source status</th></tr></thead>
<tbody>${items}</tbody></table></div>
<footer>Figures are per-Worker-instance observations, not proof of client playback. No third-party research list, IP addresses, track names or private URLs are exposed. ${healthEscape(snapshot.generated_at)}</footer>
</main></body></html>`;
  return new Response(html, {status:200,headers:responseHeaders});
}

async function bitChordMainFetch(request, env = {}, ctx = {}) {
    const workerOrigin = new URL(request.url).origin;
    const url = new URL(request.url);

    // ------------------------------------------------------------------------
    // PRIVATE R2 BACKEND, PUBLIC PLAYBACK URL. Only configured track IDs work.
    // BitChord requests bytes from this route with HTTP Range support.
    // ------------------------------------------------------------------------
    if (url.pathname.startsWith("/audio/personal/")) {
      return servePersonalFlac(request, env, url);
    }

    // ------------------------------------------------------------------------
    // PRIVATE R2 CACHE AUDIO: signed URLs, expiry checked BEFORE R2 GET.
    if (url.pathname.startsWith("/audio/cache/")) {
      return serveCachedFlac(request, env, url, ctx);
    }

    if (url.pathname === "/health/source-check") return sourceCheckResponse(request, env);

    if (url.pathname === "/health" || url.pathname === "/health/") {
      if (request.method !== "GET" && request.method !== "HEAD") return noStream(405);
      if (request.method === "HEAD") return new Response(null, {
        status: freeSourceEnabled(env, 'HEALTH_DASHBOARD_ENABLED') ? 200 : 404,
        headers: {'Cache-Control': 'private, no-store'}
      });
      return await healthDashboardResponse(url, env);
    }

    // ROUTE 1: GET /manifest.json
    // ------------------------------------------------------------------------
    if (url.pathname === "/manifest.json") {
      // Respect Provider 12's manifest setting allowDownloads=false. A single BitChord
      // manifest cannot express per-provider download permissions, so when
      // Provider 12 is enabled we advertise streaming-only for this entire addon.
      // This UI declaration does not itself enforce client-side storage rules.
      return json({ ...MANIFEST,
        allowDownloads: configuredAddonUrl(12, env) ? 0 : MANIFEST.allowDownloads,
        atmos: freeSourceEnabled(env, "ATMOS_ENABLED") ? 1 : 0 }, 120);
    }

    // ------------------------------------------------------------------------
    // ROUTE 2: GET /search?q=...
    // ------------------------------------------------------------------------
    if (url.pathname === "/search") {
      const query = (url.searchParams.get("q") || "").trim();
      if (!query) return json({ tracks: [] });
      flacDiagRecord("search_request");
      const wantAtmos = wantsAtmos(url, env);

      // Stage 1: responsive/known-working sources. Stage 2 is launched only
      // if the initial search has too few results. Provider indexes stay fixed.
      const started = Date.now();
      const controller = new AbortController();
      const enabled = DISCORD_ADDONS
        .map((_, index) => ({ addonUrl: configuredAddonUrl(index, env), index }))
        .filter(({ addonUrl }) => addonUrl && !addonUrl.includes("example-discord-addon"))
        .sort((a, b) => preferredRank(a.index) - preferredRank(b.index));
      // A provider returning stream 429 must not remain in search results
      // as though it can currently upgrade playback. Re-include after cooldown.
      const healthy = enabled.filter(({ index }) =>
        !providerCooling(index, "search") && !providerCooling(index, "stream"));
      console.log(`[PROVIDER PRIORITY] phase=search order=${healthy.map(({ index }) => `discord_${index}`).join(",") || "all_cooling"} evidence=verified_flac_and_recent_health`);
      // If all sources are cooling down, probe only the first two rather than
      // hammering every broken endpoint simultaneously.
      // Avoid immediately re-querying sources already in cooldown. They re-enter
      // automatically when their individual cooldown expires.
      // Keep transient trial sources from displacing stable sources. When the
      // trial proves a real FLAC stream it can join normal adaptive ranking.
      const selected = [
        ...healthy.filter(({ index }) => !ROTATING_PROVIDER_INDEXES.has(index) || (STREAM_HEALTH.get(index)?.ok || 0) > 0),
        ...healthy.filter(({ index }) => ROTATING_PROVIDER_INDEXES.has(index) && !(STREAM_HEALTH.get(index)?.ok || 0))
      ];
      const primary = selected.slice(0, SEARCH_PRIMARY_COUNT);
      const secondary = selected.slice(SEARCH_PRIMARY_COUNT);
      const results = [];
      const pending = new Map();
      const finished = new Set();
      let completed = 0;
      let secondaryStarted = false;
      let simplifiedStarted = false;
      let nextSecondaryIndex = 0;
      let thirdWaveStarted = false;
      let fourthWaveStarted = false;
      const simplifiedQuery = simplifiedSearchQuery(query);
      let totalTracks = 0;
      let trustedCatalogTracks = 0;
      let strictQueryMatches = 0;
      const signal = controller.signal;
      const jamendoEnabled = Boolean(getJamendoClientId(env));
      const archiveEnabled = Boolean(FALLBACK_SOURCES.IA_ENABLED);
      const personalEnabled = Boolean(env?.FLAC_BUCKET);
      const openverseEnabled = freeSourceEnabled(env, "OPENVERSE_ENABLED");
      const commonsEnabled = freeSourceEnabled(env, "COMMONS_ENABLED");
      console.log(`[SOURCE CONFIG] jamendo=${jamendoEnabled ? "enabled" : "disabled_missing_client_id"} archive=${archiveEnabled ? "enabled" : "disabled"} personal=${personalEnabled ? "enabled" : "disabled"} openverse=${openverseEnabled ? "enabled" : "disabled"} commons=${commonsEnabled ? "enabled" : "disabled"}`);

      function launch(label, producer) {
        // Completion promises always resolve. Pending requests will be aborted
        // before returning, so slow upstreams do not keep running needlessly.
        const task = Promise.resolve().then(producer).then(
          (tracks) => ({ label, tracks: Array.isArray(tracks) ? tracks : [], error: null }),
          (error) => ({ label, tracks: [], error })
        ).then((result) => {
          pending.delete(label);
          if (!signal.aborted) {
            finished.add(label);
            completed++;
            results.push(...result.tracks);
            const claims = result.tracks.filter(isLosslessTrackClaim).length;
            const eligible = result.tracks.filter(isLosslessSearchCandidate);
            totalTracks += eligible.length;
            // p9: count original-query-consistent catalog matches separately.
            // Only a strict metadata match counts. This is discovery evidence,
            // NOT permission to bypass recording/version/duration/byte checks.
            if (label !== 'simplified_retry')
              strictQueryMatches += eligible.filter(t => simplifiedResultMatchesOriginal(t, query)).length;
            const indexed = /^discord_(\d+)$/.exec(label);
            if (indexed && ((STREAM_HEALTH.get(Number(indexed[1]))?.ok || 0) > 0 ||
                HISTORICALLY_VERIFIED_PROVIDERS.has(Number(indexed[1]))))
              trustedCatalogTracks += eligible.length;
            if (label === 'personal' || label === 'cache') trustedCatalogTracks += claims;
            console.log(`[SOURCE RESULT] source=${label} tracks=${result.tracks.length} status=${result.error ? (result.error.status || "error") : result.tracks.length ? "results" : "empty"}`);
          }
          return result;
        });
        pending.set(label, task);
      }
      function launchDiscord(choices, ms) {
        for (const { addonUrl, index } of choices) {
          launch(`discord_${index}`, () => searchDiscordAddon(addonUrl, index, query, ms, signal, wantAtmos));
        }
      }
      function discoveryStillThin() {
        return totalTracks < SEARCH_TARGET_RESULTS ||
          trustedCatalogTracks < SEARCH_TRUSTED_RESULT_TARGET;
      }
      function launchSecondaryWave(elapsed) {
        if (!discoveryStillThin() || nextSecondaryIndex >= secondary.length) return false;
        const remaining = SEARCH_TOTAL_BUDGET_MS - elapsed;
        if (remaining < 550) return false;
        const batch = secondary.slice(nextSecondaryIndex, nextSecondaryIndex + SEARCH_SECONDARY_BATCH_SIZE);
        nextSecondaryIndex += batch.length;
        launchDiscord(batch, Math.min(SEARCH_SECONDARY_TIMEOUT_MS, remaining - 150));
        console.log(`[SEARCH EXPANDED] sources=${batch.length} cumulative_secondary=${nextSecondaryIndex} early_tracks=${totalTracks}`);
        return true;
      }
      launchDiscord(primary, SEARCH_TIMEOUT_MS);
      if (jamendoEnabled) launch("jamendo", () => searchJamendo(query, env, SEARCH_TIMEOUT_MS, signal));
      if (archiveEnabled) launch("ia", () => searchArchiveFlac(query, signal));
      if (personalEnabled) launch("personal", () => searchPersonalFlac(query, env));
      if (flacCacheEnabled(env)) launch("cache", () => searchCachedFlac(query, env));
      // A timed wake-up allows the fallback tier to start without waiting for
      // unrelated slow requests to finish.
      const waitUntil = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(1, ms)));
      try {
        while (Date.now() - started < SEARCH_TOTAL_BUDGET_MS +
            (simplifiedStarted ? SEARCH_EMPTY_FALLBACK_EXTRA_MS : 0)) {
          const elapsed = Date.now() - started;
          if (!secondaryStarted &&
              (elapsed >= SEARCH_INITIAL_WAIT_MS || pending.size === 0)) {
            secondaryStarted = true;
            launchSecondaryWave(elapsed);
            // Open public catalogs only when the first tier lacks enough
            // FLAC-claimed results. They cannot slow successful fast searches.
            if (totalTracks < SEARCH_TARGET_RESULTS || trustedCatalogTracks < SEARCH_TRUSTED_RESULT_TARGET) {
              if (openverseEnabled) launch("openverse", () => searchOpenverseFlac(query, env, signal));
              if (commonsEnabled) launch("commons", () => searchCommonsFlac(query, env, signal));
            }
          }
          // p9: later waves are only launched for thin catalogs, not every
          // backup on each query. They still get a chance when earlier waves
          // fail, and all calls remain inside the original search deadline.
          if (secondaryStarted && !thirdWaveStarted &&
              elapsed >= SEARCH_THIRD_WAVE_AT_MS) {
            thirdWaveStarted = true;
            launchSecondaryWave(elapsed);
          }
          if (secondaryStarted && !fourthWaveStarted &&
              elapsed >= SEARCH_FOURTH_WAVE_AT_MS) {
            fourthWaveStarted = true;
            launchSecondaryWave(elapsed);
          }
          // Retry one title-focused query not just when the catalog is empty,
          // but when it has no eligible candidates matching the ORIGINAL query.
          // The retry is still only one provider, bounded by the same budget;
          // strict original-query metadata filtering remains mandatory.
          if (!simplifiedStarted && simplifiedQuery && strictQueryMatches === 0 &&
              elapsed >= SEARCH_INITIAL_WAIT_MS) {
            const ready = primary.find(({ index }) =>
              finished.has(`discord_${index}`) &&
              !providerCooling(index, 'search') && !providerCooling(index, 'stream'));
            const remaining = SEARCH_TOTAL_BUDGET_MS + SEARCH_EMPTY_FALLBACK_EXTRA_MS - elapsed;
            if (ready && remaining >= 700) {
              simplifiedStarted = true;
              flacDiagRecord("search_simplified");
              console.log(`[SEARCH SIMPLIFIED] provider=discord_${ready.index} method=bounded_title_retry strict_result_filter=true`);
              launch('simplified_retry', async () => {
                const tracks = await searchDiscordAddon(ready.addonUrl, ready.index,
                  simplifiedQuery, Math.min(SEARCH_SIMPLIFIED_TIMEOUT_MS, remaining - 100), signal, wantAtmos);
                const matching = tracks.filter(t => simplifiedResultMatchesOriginal(t, query));
                console.log(`[SEARCH SIMPLIFIED RESULT] candidates=${tracks.length} matched=${matching.length}`);
                return matching;
              });
            }
          }
          // Wait at least the initial discovery window to give new free sources
          // a fair chance, but return early when a useful result set is ready.
          if (elapsed >= SEARCH_INITIAL_WAIT_MS && totalTracks >= SEARCH_TARGET_RESULTS &&
              trustedCatalogTracks >= SEARCH_TRUSTED_RESULT_TARGET && finished.size >= 2 &&
              (!simplifiedQuery || strictQueryMatches > 0 || simplifiedStarted)) break;
          if (secondaryStarted && pending.size === 0 &&
              (elapsed >= SEARCH_INITIAL_WAIT_MS || !simplifiedQuery) &&
              (!discoveryStillThin() || nextSecondaryIndex >= secondary.length)) break;
          const budgetRemaining = SEARCH_TOTAL_BUDGET_MS +
            (simplifiedStarted ? SEARCH_EMPTY_FALLBACK_EXTRA_MS : 0) - elapsed;
          // Recheck promptly when waiting for a completed provider that could
          // be eligible for the one extra query, rather than sleeping to deadline.
          const nextWake = secondaryStarted
            ? Math.min(budgetRemaining, 160)
            : Math.min(SEARCH_INITIAL_WAIT_MS - elapsed, budgetRemaining);
          if (nextWake <= 0) continue;
          await Promise.race([ ...pending.values(), waitUntil(nextWake) ]);
        }
      } finally {
        const cancelled = pending.size;
        controller.abort();
        console.log(`[SEARCH PERFORMANCE] elapsed_ms=${Date.now() - started} tracks=${totalTracks} original_query_matches=${strictQueryMatches} trusted_catalog_candidates=${trustedCatalogTracks} sources_done=${completed} cancelled=${cancelled} secondary_launched=${nextSecondaryIndex} simplified_retry=${simplifiedStarted}`);
      }

      let allTracks = results;
      if (LOSSLESS_ONLY) {
        const uncertainCounts = new Map();
        allTracks = allTracks.filter(t => {
          if (isLosslessTrackClaim(t) || (wantAtmos && isAtmosTrackClaim(t))) return true;
          if (!isLosslessSearchCandidate(t)) return false;
          const provider = String(t.id).split(':')[0];
          const n = uncertainCounts.get(provider) || 0;
          if (n >= 3) return false;
          uncertainCounts.set(provider,n+1); return true;
        });
      }
      allTracks = await addKnownAlternatives(allTracks, env);
      const sortRankCache = new Map();
      function sortSourceRank(provider) {
        if (!sortRankCache.has(provider)) sortRankCache.set(provider, sourceRank(provider));
        return sortRankCache.get(provider);
      }
      allTracks.sort((a, b) => {
        // Advertised Atmos mixes rank first only for eligible opt-in requests.
        if (wantAtmos) {
          const p = Number(isAtmosTrackClaim(b)) - Number(isAtmosTrackClaim(a));
          if (p) return p;
        }
        const aProvider = String(a.id).split(":")[0];
        const bProvider = String(b.id).split(":")[0];
        // A Hi-Res SEARCH BADGE is not byte-verified; prioritize providers
        // with proven FLAC handoffs before advertised bit depth.
        const reliability = sortSourceRank(aProvider) - sortSourceRank(bProvider);
        if (reliability) return reliability;
        return getQualityScore(b) - getQualityScore(a);
      });
      flacDiagRecord(allTracks.length ? "search_results" : "search_empty");
      console.log(`[SEARCH READY] tracks=${allTracks.length} mode=${wantAtmos ? "atmos_preferred" : "flac_only"} verified_at_search=false`);
      // Short cache: fast searches are intentionally partial when slow sources
      // miss the deadline; do not hold partial results for a full minute.
      return json({ tracks: allTracks }, allTracks.length ? 20 : 0);
    }

    // ------------------------------------------------------------------------
    // ROUTE 3: GET /stream/{provider}:{id}
    // ------------------------------------------------------------------------
    if (url.pathname.startsWith("/stream/")) {
      // Count ARRIVALS, not just valid provider stream resolutions. The earlier
      // stream_request counter is deliberately kept AFTER validation as a
      // separate measure. Only allowlisted reason/provider labels are retained.
      flacDiagRecord("stream_route_hit");
      const rejectStreamPreflight = (reason, provider = 'system', status = 404) => {
        flacDiagRecord("stream_preflight_rejected", provider, reason);
        console.warn(`[STREAM PREFLIGHT REJECT] provider=${flacDiagProvider(provider)} reason=${reason}`);
        return noStream(status);
      };
      let rawId;
      try {
        rawId = decodeURIComponent(url.pathname.slice(8)).trim();
      } catch {
        return rejectStreamPreflight('bad_encoded_path', 'system', 400);
      }
      const requestedQuality = (url.searchParams.get("quality") || "lossless").toLowerCase();
      const wantAtmos = wantsAtmos(url, env);
      const atmos = wantAtmos ? "auto" : "";
      const colonIndex = rawId.indexOf(":");
      if (colonIndex === -1) return rejectStreamPreflight('missing_provider_separator');

      const provider = rawId.slice(0, colonIndex);
      const encodedTrackId = rawId.slice(colonIndex + 1);
      // BitChord normally passes only a track ID to /stream. Embed minimal,
      // non-secret metadata in newly returned IDs so failed tracks can be
      // searched safely at other providers without a KV database.
      const { nativeId: trackId, metadata } = unpackTrackId(encodedTrackId);
      if (!trackId) return rejectStreamPreflight('invalid_track_id', provider);
      if (!/^discord_\d+$/.test(provider) && !["saavn", "yt", "ia", "jamendo", "personal", "openverse", "commons", "cache"].includes(provider)) return rejectStreamPreflight('unsupported_provider', provider);
      // Indexes 7/8/9 were used inconsistently across earlier private builds.
      // Never play an ambiguous saved track against a different provider.
      // Require a fresh ID produced by THIS provider layout.
      // Reject retired/reserved IDs BEFORE checking R2 cache, provider config
      // or cross-provider recovery. Saved discord_0/discord_1 IDs cannot revive sources.
      if (provider.startsWith('discord_') && RETIRED_PROVIDER_INDEXES.has(Number(provider.slice(8)))) {
        console.warn(`[RETIRED PROVIDER ID] provider=${provider} action=fresh_search_required`);
        return rejectStreamPreflight('retired_provider', provider);
      }
      if (["discord_7", "discord_8", "discord_10", "discord_11", "discord_12"].includes(provider) &&
          metadata?.layout !== TRACK_LAYOUT_ID) {
        console.warn(`[STALE PROVIDER ID] provider=${provider} action=fresh_search_required`);
        return rejectStreamPreflight('stale_layout', provider);
      }

      // Provider URL overrides can change the meaning of upstream native IDs.
      // An old saved ID must be re-searched after replacing an endpoint. The
      // tag is optional only for providers still using their original URL.
      if (provider.startsWith('discord_') && !ROTATING_PROVIDER_INDEXES.has(Number(provider.slice(8)))) {
        const addonIndex = Number(provider.slice(8));
        const activeUrl = configuredAddonUrl(addonIndex, env);
        if (providerUsesChangedManifest(addonIndex, activeUrl)) {
          const currentTag = await providerManifestTag(addonIndex, activeUrl);
          if (metadata?.configTag !== currentTag) {
            console.warn(`[STALE MANIFEST ID] provider=${provider} action=fresh_search_required`);
            return rejectStreamPreflight('stale_manifest', provider);
          }
        } else if (metadata?.configTag) {
          console.warn(`[STALE MANIFEST ID] provider=${provider} action=fresh_search_required`);
          return rejectStreamPreflight('stale_manifest', provider);
        }
      }

      // Rotating manifest URLs may point to a new session and different native
      // IDs. Never replay saved tracks against a newly issued credential.
      if (provider.startsWith('discord_') && ROTATING_PROVIDER_INDEXES.has(Number(provider.slice(8)))) {
        const index = Number(provider.slice(8));
        const currentUrl = configuredAddonUrl(index, env);
        if (!currentUrl || metadata?.session !== await rotatingAddonSessionTag(index, currentUrl)) {
          console.warn(`[ROTATING SESSION] provider=${provider} previous_session_or_disabled action=fresh_search_required`);
          return rejectStreamPreflight('expired_or_disabled_session', provider);
        }
      }

      // BitChord may request HIGH during quality negotiation; this addon is
      // FLAC-only and deliberately asks upstream for LOSSLESS instead.
      const quality = ["hi_res_lossless", "hires_lossless", "lossless", "flac"].includes(requestedQuality)
        ? requestedQuality : "lossless";
      const started = Date.now();
      flacDiagRecord("stream_request", provider);
      // Check R2 first, even if the original provider has gone offline.
      // The full, normalized recording metadata is part of the cache key, so
      // (for example) Original Mix and Album Edit never share a cached file.
      const cacheKey = provider !== "cache" && !ROTATING_PROVIDER_INDEXES.has(Number(provider.slice(8))) && flacCacheEnabled(env) && metadata
        ? await flacCacheKey(provider, trackId, metadata) : null;
      // A cached stereo FLAC must not hide a newly available Atmos rendition.
      if (cacheKey && !wantAtmos) {
        const hit = await resolveCachedFlac(cacheKey, env, workerOrigin);
        if (hit) {
          flacDiagRecord("stream_cached_handoff", "cache");
          console.log(`[FLAC CACHE HIT] provider=${provider}`);
          return json(hit, 0);
        }
        console.log(`[FLAC CACHE MISS] provider=${provider}`);
      }
      let primaryError = null;
      let streamData = null;
      let primaryElapsedMs = 0;
      const primaryStart = Date.now();
      try {
        if (provider.startsWith("discord_")) {
          const addonIndex = Number(provider.slice(8));
          const addonBaseUrl = configuredAddonUrl(addonIndex, env);
          // A provider-wide 429/5xx cooldown must also apply to the primary
          // resolver; earlier revisions only checked cooldown during rescue.
          // Skipping lets metadata-aware rescue try a different approved source
          // without sending more requests to a throttling upstream.
          if (addonBaseUrl && !providerCooling(addonIndex, "stream")) {
            try {
              // A known, verified-metadata alternate lets us abandon a stalled primary
              // resolver earlier, saving up to 900 ms on dead sources.
              const primaryTimeout = metadata?.alt?.length ? Math.min(STREAM_TIMEOUT_MS, 2300) : STREAM_TIMEOUT_MS;
              streamData = await resolveDiscordAddon(addonBaseUrl, trackId, quality, atmos, addonIndex, false, primaryTimeout, wantAtmos, env, started + PRIMARY_RESOLUTION_BUDGET_MS, metadata);
            } catch (err) {
              primaryError = err;
              console.warn(`[PRIMARY FAILURE] provider=${provider} reason=${safeError(err)}`);
            }
          } else if (addonBaseUrl) {
            console.warn(`[PRIMARY SKIPPED] provider=${provider} reason=provider_stream_cooldown`);
          }
          primaryElapsedMs = Date.now() - primaryStart;
          console.log(`[STREAM PHASE] stage=primary provider=${provider} elapsed_ms=${primaryElapsedMs} stream=${streamData ? "candidate" : "none"}`);
          // FLAC header verification proves format, not song identity.
          // Reject contradicting duration, title, artist or version metadata.
          if (streamData && metadata && !streamMatchesExpectedIdentity(streamData, metadata)) {
            console.warn(`[REJECTED WRONG RECORDING] provider=${provider} action=try_alternative`);
            streamData = null;
          }
          if (!isAllowedStream(streamData, wantAtmos)) {
            if (streamData) console.warn(`[REJECTED UNSUPPORTED AUDIO] provider=${provider}`);
            streamData = null;
          }
          if (!streamData && metadata) {
            streamData = await findMatchingFlacStream(metadata, provider, quality, atmos, started, env, workerOrigin);
          } else if (!streamData) {
            console.warn(`[NO CROSS-PROVIDER METADATA] provider=${provider} action=search_again_in_BitChord`);
          }
        } else if (provider === "ia") {
          streamData = await resolveArchiveFlac(trackId);
          if (!isFlacStream(streamData) && metadata)
            streamData = await findMatchingFlacStream(metadata, provider, quality, atmos, started, env, workerOrigin);
        } else if (provider === "jamendo") {
          streamData = await resolveJamendoFlac(trackId, env, metadata);
          if (!isFlacStream(streamData) && metadata)
            streamData = await findMatchingFlacStream(metadata, provider, quality, atmos, started, env, workerOrigin);
        } else if (provider === "personal") {
          streamData = await resolvePersonalFlac(trackId, env, workerOrigin);
          if (!isFlacStream(streamData) && metadata)
            streamData = await findMatchingFlacStream(metadata, provider, quality, atmos, started, env, workerOrigin);
        } else if (provider === "openverse") {
          streamData = await resolveOpenverseFlac(trackId, env);
          if (!isFlacStream(streamData) && metadata)
            streamData = await findMatchingFlacStream(metadata, provider, quality, atmos, started, env, workerOrigin);
        } else if (provider === "cache") {
          streamData = await resolveCachedFlac(trackId, env, workerOrigin);
        } else if (provider === "commons") {
          streamData = await resolveCommonsFlac(trackId, env);
          if (!isFlacStream(streamData) && metadata)
            streamData = await findMatchingFlacStream(metadata, provider, quality, atmos, started, env, workerOrigin);
        } else {
          // JioSaavn and Piped return lossy formats; intentionally disabled.
          console.warn(`[LOSSLESS ONLY] refused lossy source=${provider}`);
        }

        // This is an additional guard, not a substitute for authoritative
        // provider metadata checks in resolvers. Never reward a wrong recording.
        if (provider === 'jamendo' && streamData &&
            (!metadata || !jamendoRecordingMatchDecision(metadata, streamData).ok)) {
          flacDiagRecord('identity_rejected', 'jamendo', 'wrong_recording_identity');
          console.warn('[JAMENDO IDENTITY REJECT] phase=final_guard');
          streamData = null;
        }
        if (!isAllowedStream(streamData, wantAtmos)) {
          console.warn(`[NO SUPPORTED AUDIO] provider=${provider} mode=${wantAtmos ? "atmos_preferred" : "flac_only"}`);
          if (primaryError) console.warn(`[PRIMARY ERROR CLASS] provider=${provider} code=${primaryError.status || 502}`);
          console.log(`[STREAM TIMING] mode=${wantAtmos ? "atmos" : "flac"} outcome=unavailable primary_ms=${primaryElapsedMs} total_ms=${Date.now() - started}`);
          flacDiagRecord("stream_unavailable", provider, "no_verified_playable_stream");
          console.warn(`[STREAM UNAVAILABLE] provider=${provider} reason=no_verified_playable_stream http_status=404`);
          return noStream(404);
        }
        flacDiagRecord(isAtmosStream(streamData) ? "stream_atmos_handoff" : "stream_flac_handoff", streamData._resolvedProvider || provider);
        console.log(`[${isAtmosStream(streamData) ? "ATMOS READY" : "FLAC READY"}] requested=${provider} resolved=${streamData._resolvedProvider || provider} elapsed_ms=${Date.now() - started}`);
        console.log(`[STREAM TIMING] mode=${wantAtmos ? "atmos" : "flac"} primary_ms=${primaryElapsedMs} total_ms=${Date.now() - started} rescue=${Boolean(streamData._resolvedProvider)}`);
        console.log(`[PLAYBACK HANDOFF] mode=${isAtmosStream(streamData) ? "atmos" : "flac"} provider=${streamData._resolvedProvider || provider} json_returned=true bytes_played_by_client=unknown`);
        // Only cache on an explicit, rights-reviewed provider allowlist.
        // Never block first playback while downloading a second copy into R2.
        const resolvedProvider = streamData._resolvedProvider || provider;
        if (cacheKey && isFlacStream(streamData) && isCacheProviderAllowed(env, resolvedProvider) &&
            isPlayableUrl(streamData.url) && ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(saveFlacCache(cacheKey, streamData.url, metadata, resolvedProvider, env)
            .catch(() => console.warn("[FLAC CACHE SKIP] reason=write_error")));
        }
        // Never leak internal routing metadata to the BitChord playback client.
        if (streamData._resolvedProvider) {
          const { _resolvedProvider, ...publicStreamData } = streamData;
          return json(publicStreamData, 0);
        }
        return json(streamData, 0);
      } catch (err) {
        flacDiagRecord("stream_error", provider, err?.status || "stream_error");
        console.error(`[STREAM FAILURE] provider=${provider} reason=${safeError(err)}`);
        return noStream(err?.status === 504 ? 504 : 502);
      }
    }

    return new Response(null, { status: 404 });
}

export default {
  async fetch(request, env = {}, ctx = {}) {
    try {
      return await bitChordMainFetch(request, env, ctx);
    } finally {
      // Run off the playback critical path. If no DO binding exists, keep
      // displaying the old per-isolate counters with a clear warning.
      if (env?.FLAC_DIAGNOSTICS && ctx && typeof ctx.waitUntil === 'function')
        ctx.waitUntil(flacDiagFlush(env));
    }
  },
  async scheduled(event, env = {}, ctx = {}) {
    if (!flacCacheEnabled(env)) return;
    // Cloudflare Cron Trigger: 0 * * * * (once per hour).
    const task = cleanExpiredFlacCache(env);
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(task);
    else await task;
  }
};

// ============================================================================
// NETWORK OPTIMIZATION & LOGGING (AbortController + Console logs)
// ============================================================================
// Single fast attempts for interactive playback; no slow automatic retries.
async function fetchWithTimeout(url, options = {}, ms = 8500, sourceName = "Unknown", retries = 0) {
  const parentSignal = options.signal;
  const requestOptions = { ...options };
  delete requestOptions.signal;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (parentSignal?.aborted) {
      const cancelled = new Error("search_cancelled");
      cancelled.status = 499;
      throw cancelled;
    }
    const controller = new AbortController();
    const parentAbort = () => controller.abort("search_cancelled");
    if (parentSignal) parentSignal.addEventListener("abort", parentAbort, { once: true });
    const timeoutId = setTimeout(() => controller.abort("upstream_timeout"), ms);
    try {
      // A hard rejection guard is needed for upstream fetch implementations
      // that do not settle immediately when their AbortSignal is triggered.
      let rejectAbort;
      const aborted = new Promise((_, reject) => { rejectAbort = reject; });
      const onAbort = () => {
        const error = new Error("AbortError");
        error.name = "AbortError";
        rejectAbort(error);
      };
      controller.signal.addEventListener("abort", onAbort, { once: true });
      let response;
      try {
        response = await Promise.race([
          fetch(url, { ...requestOptions, signal: controller.signal }),
          aborted
        ]);
      } finally {
        controller.signal.removeEventListener("abort", onAbort);
      }
      if (parentSignal?.aborted) {
        try { await response.body?.cancel(); } catch {}
        const cancelled = new Error("search_cancelled");
        cancelled.status = 499;
        throw cancelled;
      }
      if (response.ok) return response;
      const transient = response.status >= 500;
      console.warn(`[UPSTREAM HTTP] ${sourceName} status=${response.status} attempt=${attempt + 1}`);
      if (!transient || attempt === retries) return response;
      try { await response.body?.cancel(); } catch {}
    } catch (error) {
      if (parentSignal?.aborted || error?.status === 499) {
        const cancelled = new Error("search_cancelled");
        cancelled.status = 499;
        throw cancelled;
      }
      const timeout = controller.signal.aborted || error?.name === "AbortError";
      console.warn(`[UPSTREAM ${timeout ? "TIMEOUT" : "NETWORK"}] ${sourceName} attempt=${attempt + 1}`);
      if (attempt === retries) {
        const err = new Error(timeout ? "upstream_timeout" : "upstream_network_error");
        err.status = timeout ? 504 : 502;
        throw err;
      }
    } finally {
      clearTimeout(timeoutId);
      if (parentSignal) parentSignal.removeEventListener("abort", parentAbort);
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
}

// p6: fetch() resolves at headers; consume JSON within the SAME request budget.
async function readJsonWithinDeadline(response, deadline, signal, maxBytes = 2 * 1024 * 1024) {
  let reader, timer, abortHandler;
  const stop = () => { try { void reader?.cancel().catch(() => {}); } catch {} };
  const failure = (status, message) => Object.assign(new Error(message), {status});
  if (!response.body) throw failure(502, "upstream_empty_body");
  reader = response.body.getReader();
  const work = (async () => {
    const decoder = new TextDecoder();
    let size = 0, text = "";
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw failure(502, "upstream_json_too_large");
      text += decoder.decode(value, {stream:true});
    }
    text += decoder.decode();
    return JSON.parse(text);
  })();
  const bounded = new Promise((_, reject) => {
    const timeout = () => { reject(failure(504, "upstream_body_timeout")); stop(); };
    abortHandler = () => { reject(failure(499, "search_cancelled")); stop(); };
    timer = setTimeout(timeout, Math.max(0, deadline - Date.now()));
    if (signal?.aborted) abortHandler();
    else signal?.addEventListener("abort", abortHandler, {once:true});
    if (deadline <= Date.now()) timeout();
  });
  try { return await Promise.race([bounded, work]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortHandler);
    stop();
  }
}

// ============================================================================
// DISCORD ADDON PROXY HANDLERS
// ============================================================================
async function searchDiscordAddon(baseUrl, index, query, timeoutMs = SEARCH_TIMEOUT_MS, signal = undefined, wantAtmos = false) {
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/manifest\.json$/i, "");
  const searchStart = Date.now();
  flacDiagRecord("provider_search_start", index);
  let res;
  try {
    const params = new URLSearchParams({ q: query });
    // Provider 10's published manifest uses max/high/low, not LOSSLESS.
    // The max setting only requests best available quality; it is NOT FLAC proof.
    if (index === 10) params.set('quality', 'max');
    else if (wantAtmos) { params.set("quality", "lossless"); params.set("atmos", "auto"); }
    res = await fetchWithTimeout(`${cleanBase}/search?${params}`, {
      headers: { "Accept": "application/json" }, signal
    }, timeoutMs, `DiscordSearch(${index})`);
  } catch (err) {
    if (err?.status !== 499) {
      rotatingProviderDiagnostic(index, 'search', rotatingErrorOutcome(err?.status || 504), err?.status || 504);
      observeSearchHealth(index, false);
      flacDiagRecord("provider_search_error", index,
        err?.message === 'upstream_timeout' ? 'timeout_or_504' : (err?.status || 504));
      noteProviderFailure(index, "search", err?.status || 504);
    }
    throw err;
  }
  if (!res.ok) {
    if (res.status === 402) console.warn(`[UPSTREAM ACCESS REQUIRED] provider=discord_${index} stage=search status=402 action=temporary_cooldown`);
    rotatingProviderDiagnostic(index, 'search', rotatingErrorOutcome(res.status), res.status);
    observeSearchHealth(index, false);
    flacDiagRecord("provider_search_error", index, res.status);
    noteProviderFailure(index, "search", res.status);
    return [];
  }
  let data;
  try { data = await readJsonWithinDeadline(res, searchStart + timeoutMs, signal); }
  catch (err) {
    if (err?.status === 499) return [];
    const status = err?.status || 502;
    rotatingProviderDiagnostic(index, 'search', status === 504 ? 'timeout' : 'invalid_json', status);
    observeSearchHealth(index, false);
    flacDiagRecord("provider_search_error", index,
      err?.message === 'upstream_body_timeout' ? 'timeout_or_504'
      : status === 504 ? 504 : "invalid_json");
    noteProviderFailure(index, "search", status); return [];
  }
  observeSearchHealth(index, true, Date.now() - searchStart);
  flacDiagRecord("provider_search_ok", index);
  noteProviderSuccess(index, "search");
  const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
  const classes = {lossless_claim:0, pcm_hint:0, unknown:0, incompatible:0};
  for (const t of tracks) classes[catalogAudioClass(t)]++;
  console.log(`[CATALOG AUDIO] provider=discord_${index} lossless_claim=${classes.lossless_claim} pcm_hint=${classes.pcm_hint} unknown=${classes.unknown} incompatible=${classes.incompatible}`);
  rotatingProviderDiagnostic(index, 'search', tracks.length ? 'results' : 'empty');
  const session = ROTATING_PROVIDER_INDEXES.has(index) ? await rotatingAddonSessionTag(index, baseUrl) : null;
  const configTag = providerUsesChangedManifest(index, baseUrl)
    ? await providerManifestTag(index, baseUrl) : null;
  return tracks.filter((t) => t && (typeof t.id === "string" || typeof t.id === "number") && String(t.id).length < 500 &&
    // A changed endpoint requires metadata to stamp a fresh provenance tag.
    (!configTag || !!trackMetadata(t)) &&
    // Trial source needs recording identity and an explicit lossless claim.
    (!ROTATING_PROVIDER_INDEXES.has(index) || (trackMetadata(t) && isLosslessSearchCandidate(t)))).map((t) => {
    const meta = trackMetadata(t);
    const signedMeta = meta ? { ...meta, layout: TRACK_LAYOUT_ID,
      ...(configTag ? { configTag } : {}), ...(session ? { session } : {}) } : null;
    return {
      ...t,
      id: `discord_${index}:${t.id}${signedMeta ? METADATA_MARKER + encodeMetadata(signedMeta) : ""}`
    };
  });
}

// Some providers return a bare signed CDN URL without format/codec on the
// stream response even though their search listing says LOSSLESS. In that case,
// do not reject before reading the first bytes. Still reject every explicit
// lossy/Atmos/manifest indicator; the probe MUST confirm actual fLaC bytes.
// Categorize why a resolved stream is not safe to probe. No stream URL,
// credentials or track metadata is logged. A lossless search badge alone
// never overrides an explicit lossy codec or encrypted upstream response.
function unwrapClearFlacManifest(stream) {
  if (!stream || typeof stream !== 'object' || catalogAudioClass(stream) === 'incompatible' || stream.drm || stream.encrypted === true || stream.encrypted === 'true') return stream;
  if (stream.url && !/\.(?:mpd|m3u8)(?:[?#]|$)/i.test(stream.url)) return stream;
  let doc = stream.manifest;
  try {
    if (typeof doc === 'string' && doc.length <= 16000) {
      if (doc.trim().startsWith('{')) doc = JSON.parse(doc);
      else if (/^[A-Za-z0-9+/=_-]+$/.test(doc) && doc.length > 40)
        doc = JSON.parse(atob(doc.replace(/-/g,'+').replace(/_/g,'/')));
    }
  } catch { return stream; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return stream;
  // Demand explicit FLAC and explicit clear content; do not interpret DRM.
  if (!/^(?:audio\/)?(?:x-)?flac$/i.test(String(doc.codecs || doc.codec || doc.mimeType || '')) ||
      String(doc.encryptionType || '').toUpperCase() !== 'NONE' ||
      doc.encrypted === true || doc.keyId || doc.key || doc.drm ||
      !Array.isArray(doc.urls) || doc.urls.length !== 1 || !safePublicAudioUrl(doc.urls[0])) return stream;
  if (/\.(?:m3u8|mpd|m4a|mp4)(?:[?#]|$)/i.test(doc.urls[0])) return stream;
  return {...stream,url:doc.urls[0],manifest:'none',format:'flac',codec:'flac',container:'flac'};
}

function flacProbeCandidateIssue(stream) {
  if (!stream || !safePublicAudioUrl(stream.url)) return 'unusable_url';
  if (stream.encrypted === true || stream.encrypted === 'true') return 'encrypted_stream';
  if (stream.atmos === true) return 'atmos_not_requested';
  const values = [stream.format, stream.codec, stream.container, stream.mimeType,
    stream.mime_type, stream.audioMode, stream.quality,
    stream.audioQuality, ...(Array.isArray(stream.audioModes) ? stream.audioModes : [])]
    .map(v => String(v || '').toLowerCase());
  if (values.some(v => /(?:aac|mp3|opus|vorbis|webm|mp4a|e[-_]?ac[-_]?3|eac3|ec[-_]?3|joc|ac[-_]?4|dolby|atmos|alac|mpeg|ogg)/.test(v)))
    return 'explicit_lossy_format';
  // p7: a manifest label can accompany a direct audio URL. Inspect its bytes;
  // actual playlist URLs remain unsupported and never become playable FLAC.
  try {
    const path = decodeURIComponent(new URL(stream.url).pathname).toLowerCase();
    if (/\.(?:m3u8|mpd)$/.test(path)) return 'unsupported_manifest';
    if (/\.(?:opus|webm|mp3|m4a|mp4|aac|ogg|ec3|eac3)$/.test(path))
      return 'unsupported_extension';
  } catch { return 'unusable_url'; }
  return null;
}
function isFlacProbeCandidate(stream) {
  return flacProbeCandidateIssue(stream) === null;
}

// Small bounded, private, per-isolate probe cache; never log/store signed URLs.
// Three states: true = bytes are fLaC, false = proven NOT fLaC, null =
// inaccessible or timed out. Adaptive never calls inconclusive results verified.
// Short byte-range probe. Callers can collect a SAFE categorical reason; never
// log raw stream URLs, headers, tokens, track IDs or the user's address.
// A native FLAC stream starts with fLaC. A CDN timeout is inconclusive, not lossy.
async function probeExternalFlac(url, timeoutMs = 650, diagnostics = null) {
  const note = (reason) => { if (diagnostics && !diagnostics.reason) diagnostics.reason = reason; };
  if (!safePublicAudioUrl(url)) { note("unsafe_or_unsupported_url"); return null; }
  const controller = new AbortController();
  let timeoutId;
  const attempt = (async () => {
    let reader;
    try {
      let res = await fetch(url, { headers: { Range: "bytes=0-3", "Accept-Encoding": "identity" },
        signal: controller.signal, redirect: "follow" });
      // Retry only for range-protocol errors, not 401/403/429 or other access
      // controls. Read just the header and immediately cancel the large body.
      if ([400, 416, 501].includes(res.status)) {
        try { await res.body?.cancel(); } catch {}
        if (controller.signal.aborted) return null;
        res = await fetch(url, { headers: { "Accept-Encoding": "identity" },
          signal: controller.signal, redirect: "follow" });
      }
      if (![200, 206].includes(res.status)) { note(`upstream_http_${res.status}`); return null; }
      if (!res.body) { note("missing_audio_body"); return null; }
      const contentRange = res.headers.get("content-range");
      if (res.status === 206 && contentRange && !/^bytes 0-\d+\/(?:\d+|\*)$/i.test(contentRange)) {
        note("invalid_probe_range");
        try { void res.body.cancel().catch(() => {}); } catch {}
        return null;
      }
      const type = String(res.headers.get("content-type") || "").toLowerCase();
      reader = res.body.getReader();
      const bytes = [];
      while (bytes.length < 4) {
        const chunk = await reader.read();
        if (chunk.done) break;
        for (const item of (chunk.value || [])) { if (bytes.length < 4) bytes.push(item); }
      }
      if (bytes.length !== 4) { note("incomplete_audio_header"); return null; }
      const good = bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43;
      if (good) { note("flac_magic_confirmed"); return true; }
      // HTTP-200 challenge/error documents are not evidence about the song's codec.
      if (/(?:text\/|application\/(?:json|problem\+json|xml))/.test(type) ||
          [0x3c, 0x7b, 0x5b].includes(bytes[0])) {
        note("upstream_error_document"); return null;
      }
      note("non_flac_magic_bytes");
      return false;
    } catch { note(controller.signal.aborted ? "probe_timeout" : "probe_network_error"); return null; }
    finally { if (reader) { try { void reader.cancel().catch(() => {}); } catch {} } }
  })();
  const timed = new Promise((resolve) => {
    timeoutId = setTimeout(() => { note("probe_timeout"); controller.abort(); resolve(null); }, timeoutMs);
  });
  try { return await Promise.race([attempt, timed]); }
  finally { clearTimeout(timeoutId); controller.abort(); }
}

function probeMode(env) {
  const selected = String(env?.FLAC_VERIFY_MODE || "strict").toLowerCase();
  return ["adaptive", "strict", "off"].includes(selected) ? selected : "strict";
}
// Returns structured diagnostics so inconclusive HTTP/CDN probes are never
// conflated with known non-FLAC bytes. In strict mode both are rejected, but
// only a proven wrong codec is eligible for track-level negative caching.
// Deadline-aware verification: extra time is used ONLY for slow byte checks;
// fast endpoints finish immediately. A rescue can't use time beyond its budget.
async function verifyAddonFlac(stream, index, nativeId, env = {}, deadline = 0) {
  if (!isFlacProbeCandidate(stream)) {
    flacDiagRecord("probe_non_flac", index, "metadata_incompatible");
    return { accepted: false, verdict: false, reason: "metadata_incompatible_or_unsafe" };
  }
  const mode = ROTATING_PROVIDER_INDEXES.has(index) ? 'strict' : probeMode(env);
  // Metadata-free streams are never accepted without byte proof, regardless
  // of the user's optional verification setting.
  const requiresProof = !isFlacStream(stream);
  if (mode === "off" && !requiresProof) return { accepted: true, verdict: null, reason: "verification_off" };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stream.url));
  const fingerprint = Array.from(new Uint8Array(digest).slice(0, 12),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
  const cacheKey = `${index}:${nativeId}:${mode}:${fingerprint}`;
  const cached = FLAC_PROBE_CACHE.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    const accepted = cached.verdict === true || (cached.verdict === null && mode === "adaptive");
    flacDiagRecord("probe_cache", index);
    console.log(`[FLAC PROBE CACHE] provider=discord_${index} verdict=${cached.verdict === true ? "confirmed" : "non_flac"} accepted=${accepted}`);
    return { accepted, verdict: cached.verdict, reason: cached.verdict === false ? "non_flac_bytes" : "confirmed" };
  }
  const explicitlyConfigured = Number(env?.FLAC_PROBE_TIMEOUT_MS) > 0;
  // discord_4 was the only source with confirmed handoffs in the Oct 29 trace.
  // Two otherwise valid-looking probes hit 1600ms and later retries worked;
  // give that source a bounded 300ms allowance, without relaxing FLAC checks.
  // An explicit configured timeout always takes precedence.
  const strictTimeout = !explicitlyConfigured && index === 4
    ? Math.min(2200, flacProbeTimeoutMs(env) + 300)
    : flacProbeTimeoutMs(env);
  const intendedTimeout = mode === "strict" || requiresProof ? strictTimeout : 700;
  const remaining = deadline ? deadline - Date.now() - 75 : intendedTimeout;
  // Strict mode must not accept unknown audio simply because time ran out.
  if (deadline && remaining < 200) {
    flacDiagRecord("probe_inconclusive", index, "probe_budget_exhausted");
    console.warn(`[FLAC PROBE BUDGET] provider=discord_${index} remaining_ms=${Math.max(0,remaining)}`);
    return { accepted: false, verdict: null, reason: "probe_budget_exhausted" };
  }
  const timeoutMs = Math.max(200, Math.min(intendedTimeout, remaining));
  const begin = Date.now();
  const diagnostic = {};
  const verdict = await probeExternalFlac(stream.url, timeoutMs, diagnostic);
  if (FLAC_PROBE_CACHE.size >= MAX_FLAC_PROBE_CACHE) {
    for (const [key, item] of FLAC_PROBE_CACHE) {
      if (item.expires <= Date.now()) FLAC_PROBE_CACHE.delete(key);
    }
    while (FLAC_PROBE_CACHE.size >= MAX_FLAC_PROBE_CACHE)
      FLAC_PROBE_CACHE.delete(FLAC_PROBE_CACHE.keys().next().value);
  }
  // Cache only verified results and definite non-FLAC bytes. Never cache
  // network errors, HTTP errors, or inconclusive responses as bad tracks.
  if (verdict !== null) FLAC_PROBE_CACHE.set(cacheKey, { verdict, expires: Date.now() +
    (verdict === true ? 60000 : 20000) });
  const accepted = verdict === true || (verdict === null && mode === "adaptive" && !requiresProof);
  flacDiagRecord(verdict === true ? "probe_confirmed" : verdict === false ? "probe_non_flac" : "probe_inconclusive", index, verdict === true ? "confirmed" : flacDiagReason(diagnostic.reason || "network_or_probe_error"));
  console.log(`[FLAC PROBE] provider=discord_${index} verdict=${verdict === true ? "confirmed" : verdict === false ? "non_flac" : "inconclusive"} reason=${diagnostic.reason || "unknown"} accepted=${accepted} elapsed_ms=${Date.now() - begin} budget_ms=${timeoutMs} mode=${mode}`);
  return { accepted, verdict, reason: verdict === null ? (diagnostic.reason || "probe_inconclusive") : verdict === false ? "non_flac_bytes" : "confirmed" };
}

async function resolveDiscordAddon(baseUrl, originalTrackId, quality, atmos, index, allowFallback = false, timeoutMs = STREAM_TIMEOUT_MS, wantAtmos = false, env = {}, verificationDeadline = 0, expectedRecording = null) {
  const cacheMode = wantAtmos ? "atmos" : "flac";
  const resolveStart = Date.now();
  if (streamRecentlyFailed(index, originalTrackId, cacheMode)) {
    console.log(`[TRACK SKIPPED] provider=discord_${index} reason=recent_resolution_failure`);
    return null;
  }
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/manifest\.json$/i, "");
  const tryQuality = async (requestedQuality, requestTimeoutMs = timeoutMs) => {
    const params = new URLSearchParams();
    // Only Provider 10 uses max/high/low. Never send LOW or HIGH as a downgrade:
    // we still accept only byte-verified FLAC in strict mode.
    if (requestedQuality) params.set("quality", index === 10 ? 'max' : requestedQuality);
    if (atmos) params.set("atmos", atmos);
    const streamUrl = `${cleanBase}/stream/${encodeURIComponent(originalTrackId)}?${params}`;
    const requestDeadline = Math.min(Date.now() + requestTimeoutMs,
      verificationDeadline ? verificationDeadline - 275 : Infinity);
    const remainingRequestMs = requestDeadline - Date.now();
    if (remainingRequestMs < 100) throw Object.assign(new Error("resolution_deadline"), {status:504});
    const res = await fetchWithTimeout(streamUrl, {
      headers: { "Accept": "application/json" }
    }, remainingRequestMs, `DiscordStream(${index})`, 0);

    if (res.status === 404 || res.status === 410) {
      rotatingProviderDiagnostic(index, 'stream', 'missing_track', res.status);
      markStreamFailure(index, originalTrackId, res.status, cacheMode);
      observeStreamHealth(index, false, res.status);
      return null;
    }
    if (!res.ok) {
      if (res.status === 402) console.warn(`[UPSTREAM ACCESS REQUIRED] provider=discord_${index} stage=stream status=402 action=temporary_cooldown`);
      rotatingProviderDiagnostic(index, 'stream', rotatingErrorOutcome(res.status), res.status);
      const error = new Error(`upstream_http_${res.status}`);
      error.status = res.status;
      throw error;
    }
    let data;
    try {
      data = await readJsonWithinDeadline(res, requestDeadline);
    } catch (err) {
      rotatingProviderDiagnostic(index, 'stream', 'invalid_json');
      if (err?.status) throw err;
      throw new Error("upstream_invalid_json");
    }
    data = unwrapClearFlacManifest(data);
    if (!data || typeof data !== "object" || !isPlayableUrl(data.url)) {
      rotatingProviderDiagnostic(index, 'stream', 'invalid_stream');
      markStreamFailure(index, originalTrackId, 415, cacheMode);
      observeStreamHealth(index, false, 415);
      return null;
    }
    // Reject identified wrong recordings BEFORE issuing a media-byte probe or
    // rewarding this source with a successful FLAC health observation.
    // Missing upstream metadata remains unverified, not automatically wrong.
    if (expectedRecording && !streamMatchesExpectedIdentity(data, expectedRecording)) {
      flacDiagRecord("identity_rejected", index, "wrong_recording_identity");
      console.warn(`[REJECTED WRONG RECORDING] provider=discord_${index} phase=pre_probe`);
      rotatingProviderDiagnostic(index, 'stream', 'metadata_mismatch');
      observeStreamHealth(index, false, 422, Date.now() - resolveStart);
      return null;
    }
    if (wantAtmos && isAtmosStream(data)) {
      noteProviderSuccess(index, "stream");
      // Atmos is opt-in lossy E-AC-3 JOC, not a VERIFIED FLAC success.
      // Keep its playback working but do not let it bias FLAC ranking.
      STREAM_NEGATIVE_CACHE.delete(trackFailureKey(index, originalTrackId, cacheMode));
      return normalizeAtmosStream(data);
    }
    if (isFlacProbeCandidate(data)) {
      const probe = await verifyAddonFlac(data, index, originalTrackId, env, verificationDeadline);
      if (!probe.accepted) {
        rotatingProviderDiagnostic(index, 'verification', probe.verdict === false ? 'non_flac' : 'probe_inconclusive');
        console.warn(`[FLAC PROBE REJECT] provider=discord_${index} reason=${probe.reason} mode=${ROTATING_PROVIDER_INDEXES.has(index) ? "strict" : probeMode(env)}`);
        // HTTP Range timeouts, CDN blocking and inaccessible signed URLs are
        // NOT proof of an unsupported format. Never negative-cache them as 415.
        if (probe.verdict === false) markStreamFailure(index, originalTrackId, 415, cacheMode);
        // Do not penalize provider health on inconclusive verification either.
        if (probe.verdict === false) observeStreamHealth(index, false, 415, Date.now() - resolveStart);
        if (probe.verdict === null) {
          observeStreamHealth(index, false, -1);
          // Media URL rate limiting affects playback even when the upstream
          // addon returned JSON successfully. Cool down, but do NOT cache a
          // negative result for the track based on an inconclusive check.
          const status = /^upstream_http_(403|429|502|503|504)$/.exec(probe.reason || "");
          if (status && (status[1] !== "403" || ROTATING_PROVIDER_INDEXES.has(index)))
            noteProviderFailure(index, "stream", Number(status[1]));
        }
        return null;
      }
      noteProviderSuccess(index, "stream");
      rotatingProviderDiagnostic(index, 'verification', 'confirmed');
      observeStreamHealth(index, true, 0, Date.now() - resolveStart);
      STREAM_NEGATIVE_CACHE.delete(trackFailureKey(index, originalTrackId, cacheMode));
      return normalizeFlacStream(data);
    }
    // A valid but disallowed Atmos mix is not a broken upstream recording.
    // Do not poison a later opt-in Atmos request with a FLAC-only rejection.
    if (!isAtmosStream(data)) markStreamFailure(index, originalTrackId, 415, cacheMode);
    observeStreamHealth(index, false, 415, Date.now() - resolveStart);
    const issue = isAtmosStream(data) ? 'atmos_not_requested' : (flacProbeCandidateIssue(data) || 'non_flac');
    console.log(`[STREAM SHAPE] provider=discord_${index} schema=${JSON.stringify(safeAudioShape(data))}`);
    flacDiagRecord("candidate_skip", index, flacDiagReason(issue));
    console.warn(`[FLAC CANDIDATE SKIP] provider=discord_${index} reason=${issue}`);
    rotatingProviderDiagnostic(index, 'stream', issue);
    return null;
  };

  let firstError = null;
  let data = null;
  try {
    data = await tryQuality(quality);
  } catch (err) {
    const status = err?.status || 504;
    rotatingProviderDiagnostic(index, 'stream', rotatingErrorOutcome(status), status);
    noteProviderFailure(index, "stream", status);
    observeStreamHealth(index, false, status, Date.now() - resolveStart);
    markStreamFailure(index, originalTrackId, status, cacheMode);
    firstError = err;
  }
  if (data) return data;

  // Some addons only implement quality=lossless. A Hi-Res/FLAC request may
  // return 400, 404, or empty even when a valid FLAC stream exists under the
  // standard lossless setting. Keep the retry short and lossless-only.
  if (index !== 10 && quality !== 'lossless' &&
      ['hi_res_lossless', 'hires_lossless', 'flac'].includes(quality) &&
      (!firstError || [400, 404, 410, 422].includes(firstError.status))) {
    console.log(`[LOSSLESS QUALITY RETRY] provider=discord_${index} from=${quality} to=lossless`);
    try {
      const retry = await tryQuality('lossless', Math.min(timeoutMs, 1150));
      if (retry) return retry;
    } catch (err) {
      if (!firstError) firstError = err;
    }
  }

  // Preserve lossless intent unless caller explicitly opts into lower quality.
  if (allowFallback && ["lossless", "hi_res_lossless", "hires", "flac"].includes(quality)) {
    console.warn(`[QUALITY FALLBACK] provider=discord_${index} from=${quality} to=high`);
    try {
      const fallback = await tryQuality("high");
      if (fallback) return fallback;
    } catch (err) {
      if (!firstError) firstError = err;
    }
  }
  if (firstError) throw firstError;
  return null;
}

// ============================================================================
// BUILT-IN FALLBACK 1: JIOSAAVN (Updated Parsing)
// ============================================================================
async function searchSaavn(query) {
  if (!FALLBACK_SOURCES.SAAVN_API) return [];
  const res = await fetchWithTimeout(
    `${FALLBACK_SOURCES.SAAVN_API}/search/songs?query=${encodeURIComponent(query)}&limit=6`,
    {}, 6500, "JioSaavn Search"
  );
  if (!res.ok) return [];
  const jsonResp = await res.json();
  
  // Safely fallback through common API fork structures
  const results = jsonResp?.data?.results || jsonResp?.results || jsonResp?.data || [];

  return results.map((song) => {
    // Handle variations in artist and image arrays
    const artistNames = song.artists?.primary?.map((a) => a.name).join(", ") 
                        || song.primaryArtists 
                        || "Unknown Artist";
                        
    const imageArray = song.image || song.thumbnails || [];
    const highestArt = imageArray.length > 0 ? (imageArray[imageArray.length - 1]?.url || imageArray[imageArray.length - 1]?.link) : "";

    return {
      id: `saavn:${song.id}`,
      title: cleanText(song.name || song.title || ""),
      artist: cleanText(artistNames),
      album: cleanText(song.album?.name || song.album || ""),
      duration: Number(song.duration) || 0,
      artworkURL: highestArt || "",
      format: "aac",
      audioQuality: "HIGH"
    };
  });
}

async function resolveSaavn(id, quality) {
  const res = await fetchWithTimeout(`${FALLBACK_SOURCES.SAAVN_API}/songs/${encodeURIComponent(id)}`, {}, 15000, "JioSaavn Stream");
  if (!res.ok) return null;
  const jsonResp = await res.json();
  
  // Handle single-song array vs object responses
  const song = jsonResp?.data?.[0] || jsonResp?.data || jsonResp?.[0];
  if (!song) return null;

  const urls = song.downloadUrl || song.downloadUrls || [];
  if (urls.length === 0) return null;

  let chosen = urls[urls.length - 1];
  if (quality === "low") {
    chosen = urls.find((d) => d.quality === "96kbps" || d.quality === "96") || urls[0];
  }
  
  const streamUrl = chosen?.url || chosen?.link;
  if (!streamUrl) return null;

  return {
    url: streamUrl,
    format: "aac",
    quality: quality === "low" ? "Low" : "High",
    codec: "aac",
    container: "m4a",
    manifest: "none",
    encrypted: false,
    sampleRate: 44100,
    bitDepth: 16
  };
}
// ============================================================================
// BUILT-IN FALLBACK 2: YOUTUBE MUSIC
// ============================================================================
async function searchPipedYTMusic(query) {
  if (!FALLBACK_SOURCES.PIPED_API) return [];
  const res = await fetchWithTimeout(
    `${FALLBACK_SOURCES.PIPED_API}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
    {}, 6500, "Piped YT Search"
  );
  if (!res.ok) return [];
  const data = await res.json();
  const items = data?.items || [];

  return items.slice(0, 6).map((item) => {
    const videoId = (item.url || "").replace("/watch?v=", "");
    return {
      id: `yt:${videoId}`,
      title: cleanText(item.title || ""),
      artist: cleanText(item.uploaderName || "Unknown Artist"),
      album: cleanText(item.title || "Single"),
      duration: Number(item.duration) || 0,
      artworkURL: item.thumbnail || "",
      format: "aac",
      audioQuality: "HIGH"
    };
  });
}

async function resolvePipedYTMusic(videoId, quality) {
  const res = await fetchWithTimeout(`${FALLBACK_SOURCES.PIPED_API}/streams/${encodeURIComponent(videoId)}`, {}, 15000, "Piped YT Stream");
  if (!res.ok) return null;
  const data = await res.json();
  const audioStreams = data?.audioStreams || [];
  if (audioStreams.length === 0) return null;

  const m4aStreams = audioStreams.filter((s) => (s.mimeType || "").includes("mp4"));
  const pool = m4aStreams.length > 0 ? m4aStreams : audioStreams;

  pool.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const chosen = quality === "low" ? pool[pool.length - 1] : pool[0];
  if (!chosen?.url) return null;

  return {
    url: chosen.url,
    format: (chosen.mimeType || "").includes("webm") ? "opus" : "aac",
    quality: quality === "low" ? "Low" : "High",
    codec: (chosen.mimeType || "").includes("webm") ? "opus" : "aac",
    container: (chosen.mimeType || "").includes("webm") ? "webm" : "m4a",
    manifest: "none",
    encrypted: false
  };
}

// ============================================================================
// FREE SOURCES: JAMENDO, INTERNET ARCHIVE, OPTIONAL PERSONAL R2
// ============================================================================
function getJamendoClientId(env) {
  return String(env?.JAMENDO_CLIENT_ID || "").trim();
}
function packSourceId(value) { return encodeMetadata(value); }
function unpackSourceId(value) {
  try {
    const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0))));
  } catch { return null; }
}
function sourceTrack(provider, nativeId, track) {
  const meta = trackMetadata(track);
  if (!meta || String(nativeId).length > 210) return null;
  return { ...track, id: `${provider}:${nativeId}${METADATA_MARKER}${encodeMetadata({...meta, layout: TRACK_LAYOUT_ID})}`,
    format: "flac", audioQuality: "LOSSLESS" };
}
function streamFlacUrl(url) {
  return { url, quality: "Lossless", audioQuality: "LOSSLESS", format: "flac",
    codec: "flac", container: "flac", manifest: "none", encrypted: false };
}
// Jamendo's API may return tracks only loosely related to a search. Only
// surface results that actually contain the user's words across title+artist.
// This is discovery filtering, not proof the media bytes play the same song.
function jamendoResultMatchesOriginalQuery(track, query) {
  const meta = trackMetadata(track);
  if (!meta) return false;
  const needed = [...new Set(normalizeName(query).split(' ').filter(Boolean))];
  const available = new Set(normalizeName(`${meta.title} ${meta.artist}`).split(' ').filter(Boolean));
  // A search for an original song must not silently substitute a live,
  // remix, instrumental or other edition just because its base words match.
  if (editionTags(meta.title) !== editionTags(query)) return false;
  return needed.length > 0 && needed.every(term => available.has(term));
}

// FLAC magic identifies the codec, NEVER the recording. For Jamendo demand
// reliable title, artist and duration agreement from its authoritative track
// detail record before returning any stream to BitChord.
function jamendoRecordingMatchDecision(expected, actual) {
  const wanted = trackMetadata(expected), received = trackMetadata(actual);
  if (!wanted || !received || !(wanted.duration > 0) || !(received.duration > 0))
    return { ok: false, reason: 'missing_metadata' };
  const decision = recordingMatchDecision(wanted, received);
  if (!decision.ok) return decision;
  // recordingMatchDecision includes a same-album+duration fallback for some
  // OST catalogs. That fallback is not strong enough for generic Jamendo IDs.
  const wantedArtistCredits = new Set(artistCredits(wanted.artist));
  if (!artistCredits(received.artist).some(a => wantedArtistCredits.has(a)))
    return { ok: false, reason: 'artist_mismatch' };
  const wantedTitles = new Set(titleVariants(wanted.title));
  if (!titleVariants(received.title).some(t => wantedTitles.has(t)))
    return { ok: false, reason: 'title_mismatch' };
  return decision;
}

async function searchJamendo(query, env, timeoutMs = NEW_SOURCE_TIMEOUT_MS, signal = undefined) {
  const clientId = getJamendoClientId(env);
  if (!clientId) return [];
  flacDiagRecord('provider_search_start', 'jamendo');
  const params = new URLSearchParams({ client_id: clientId, format: "json",
    search: query.slice(0, 160), audioformat: "flac", type: "single albumtrack", limit: "8" });
  try {
    const res = await fetchWithTimeout(`https://api.jamendo.com/v3.0/tracks/?${params}`,
      { headers: { Accept: "application/json" }, signal }, timeoutMs, "JamendoSearch");
    if (!res.ok) {
      flacDiagRecord('provider_search_error', 'jamendo', res.status);
      return [];
    }
    const body = await res.json();
    if (signal?.aborted) return [];
    if (body?.headers?.status !== "success") {
      flacDiagRecord('provider_search_error', 'jamendo', 'invalid_stream');
      return [];
    }
    flacDiagRecord('provider_search_ok', 'jamendo');
    return (Array.isArray(body.results) ? body.results : []).map((t) => {
      if (!t.id || !isPlayableUrl(t.audio)) return null;
      return sourceTrack("jamendo", String(t.id), {
        title: cleanText(t.name || ""), artist: cleanText(t.artist_name || ""),
        album: cleanText(t.album_name || ""), duration: Number(t.duration) || 0,
        artworkURL: t.image || "", format: "flac", audioQuality: "LOSSLESS"
      });
    }).filter(Boolean).filter(track => jamendoResultMatchesOriginalQuery(track, query));
  } catch (err) {
    if (err?.status !== 499 && !signal?.aborted) {
      flacDiagRecord('provider_search_error', 'jamendo', err?.status || 'invalid_json');
      console.warn(`[JAMENDO SEARCH] ${safeError(err)}`);
    }
    return [];
  }
}

// Check actual bytes, rather than blindly trusting a provider's codec label.
// A FLAC file starts with the ASCII signature fLaC. Send only 4 bytes in Range
// and cancel the response body as soon as those bytes arrive.
async function hasFlacMagic(url, timeoutMs = 2200) {
  if (!isPlayableUrl(url)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader;
  try {
    const response = await fetch(url, { headers: { Range: "bytes=0-3" }, signal: controller.signal });
    if (![200, 206].includes(response.status) || !response.body) return false;
    reader = response.body.getReader();
    const signature = [];
    while (signature.length < 4) {
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const byte of (chunk.value || [])) {
        signature.push(byte);
        if (signature.length === 4) break;
      }
    }
    return signature.length === 4 && signature[0] === 0x66 && signature[1] === 0x4c
      && signature[2] === 0x61 && signature[3] === 0x43;
  } catch { return false; }
  finally {
    controller.abort(); // cancels any remaining audio transfer
    clearTimeout(timer);
    try { await reader?.cancel(); } catch {}
  }
}
async function resolveJamendoFlac(id, env, expectedRecording = null) {
  const clientId = getJamendoClientId(env);
  if (!clientId || !/^\d+$/.test(String(id))) return null;
  // Legacy IDs without recording metadata are deliberately rejected. Ask the
  // client for a fresh search rather than risk playing an unrelated FLAC.
  if (!trackMetadata(expectedRecording)) {
    flacDiagRecord('identity_rejected', 'jamendo', 'missing_metadata');
    console.warn('[JAMENDO IDENTITY REJECT] reason=missing_metadata action=fresh_search_required');
    return null;
  }
  const params = new URLSearchParams({ client_id: clientId, id: String(id),
    audioformat: "flac", format: "json" });
  try {
    const res = await fetchWithTimeout(`https://api.jamendo.com/v3.0/tracks/?${params}`,
      { headers: { Accept: "application/json" } }, NEW_SOURCE_TIMEOUT_MS, "JamendoStream");
    if (!res.ok) return null;
    const body = await res.json();
    if (body?.headers?.status !== "success") return null;
    // Never take results[0] without confirming its ID corresponds to the
    // track the user selected. A provider can return a fallback item instead.
    const track = Array.isArray(body?.results) ? body.results.find(item => String(item?.id) === String(id)) : null;
    if (!track) {
      flacDiagRecord('identity_rejected', 'jamendo', 'wrong_recording_identity');
      console.warn('[JAMENDO IDENTITY REJECT] reason=track_id_mismatch');
      return null;
    }
    const actual = { title: track.name, artist: track.artist_name,
      album: track.album_name || '', duration: Number(track.duration) || 0 };
    const decision = jamendoRecordingMatchDecision(expectedRecording, actual);
    if (!decision.ok) {
      flacDiagRecord('identity_rejected', 'jamendo', flacDiagReason(decision.reason));
      console.warn(`[JAMENDO IDENTITY REJECT] reason=${flacDiagReason(decision.reason)}`);
      return null;
    }
    if (!isPlayableUrl(track.audio)) return null;
    if (!(await hasFlacMagic(track.audio))) {
      console.warn('[JAMENDO REJECT] reason=stream_not_verified_flac');
      return null;
    }
    flacDiagRecord('probe_confirmed', 'jamendo', 'confirmed');
    // Retain verified metadata for the existing downstream identity guard.
    return { ...streamFlacUrl(track.audio), ...actual };
  } catch (err) { console.warn(`[JAMENDO STREAM] ${safeError(err)}`); return null; }
}

function normalizeArchiveFileName(name) {
  const leaf = String(name || "").split("/").pop() || "";
  return leaf.replace(/\.flac$/i, "")
    .replace(/^\d{1,3}[\s._-]+/, "")
    .replace(/_/g, " ");
}
function archiveNameMatchesQuery(fileName, query, creator = "") {
  const file = normalizeName(normalizeArchiveFileName(fileName));
  const input = normalizeName(query);
  if (!file || !input) return false;
  // The IA metadata API describes collections, not individual songs.
  // Only expose actual .flac files with strongly matching filenames.
  const tokens = input.split(" ").filter((s) => s.length > 2);
  const fileWords = new Set(file.split(" "));
  const creatorWords = new Set(normalizeName(creator).split(" "));
  const fileHits = tokens.filter((s) => fileWords.has(s)).length;
  const combinedHits = tokens.filter((s) => fileWords.has(s) || creatorWords.has(s)).length;
  return tokens.length >= 2 && fileHits >= 2 && combinedHits / tokens.length >= 0.65;
}
async function searchArchiveFlac(query, signal = undefined) {
  if (!FALLBACK_SOURCES.IA_ENABLED || !query || query.length > 180) return [];
  const words = normalizeName(query).split(" ").filter((w) => w.length > 2).slice(0, 7);
  if (words.length < 2) return [];
  const q = `mediatype:(audio) AND format:(Flac) AND (${words.map((w) => `"${w}"`).join(" ")})`;
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,creator&rows=3&output=json`;
  try {
    const res = await fetchWithTimeout(url, { signal }, 1750, "ArchiveSearch");
    if (!res.ok) return [];
    const body = await res.json();
    if (signal?.aborted) return [];
    const docs = (body?.response?.docs || []).slice(0, 3);
    const results = await Promise.allSettled(docs.map(async (doc) => {
      const identifier = String(doc.identifier || "");
      if (!identifier || identifier.length > 90) return [];
      const response = await fetchWithTimeout(`https://archive.org/metadata/${encodeURIComponent(identifier)}`,
        { signal }, 1250, "ArchiveMetadata");
      if (!response.ok) return [];
      const metadata = await response.json();
      if (signal?.aborted) return [];
      const files = Array.isArray(metadata.files) ? metadata.files : [];
      const creator = Array.isArray(doc.creator) ? doc.creator[0] : doc.creator;
      // archive.org items may include many unrelated FLAC files.
      return files.filter((f) => f?.name && /\.flac$/i.test(f.name)
        && archiveNameMatchesQuery(f.name, query, creator)).slice(0, 3).map((f) =>
          sourceTrack("ia", packSourceId([identifier, f.name]), {
            title: normalizeArchiveFileName(f.name), artist: cleanText(creator || ""),
            album: cleanText(doc.title || ""), duration: 0,
            artworkURL: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
            format: "flac", audioQuality: "LOSSLESS"
          })).filter(Boolean);
    }));
    return results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  } catch (err) { if (err?.status !== 499) console.warn(`[ARCHIVE SEARCH] ${safeError(err)}`); return []; }
}
async function resolveArchiveFlac(id) {
  const parsed = unpackSourceId(id);
  if (!Array.isArray(parsed) || parsed.length !== 2) return null;
  const [identifier, fileName] = parsed;
  if (typeof identifier !== "string" || typeof fileName !== "string"
    || !identifier || identifier.length > 90 || !/\.flac$/i.test(fileName)) return null;
  const path = fileName.split("/").map(encodeURIComponent).join("/");
  const audioUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${path}`;
  // Inspect the actual file signature; do not silently substitute MP3 files.
  if (!(await hasFlacMagic(audioUrl))) return null;
  flacDiagRecord('probe_confirmed', 'ia', 'confirmed');
  return streamFlacUrl(audioUrl);
}


// ============================================================================
// FREE, PUBLIC & OPT-IN FLAC DISCOVERY (Openverse + Wikimedia Commons)
// ============================================================================
// These APIs are discovery catalogs, NOT guarantees of currently accessible
// lossless audio. Search results are *claims*; stream selection checks fLaC
// magic bytes before emitting a playback URL. API IDs are re-resolved against
// the authoritative public API, never interpreted as a user-supplied URL.
function safePublicAudioUrl(value) {
  if (typeof value !== "string" || value.length > 1900) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")
      || host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".example")
      || host === "metadata.google.internal" || host === "169.254.169.254"
      || host === "0.0.0.0" || host === "[::1]" || host === "[::]" || host === "::1") return false;
    // Block direct IPv4 literal hostnames and numeric IP encodings. A static
    // source hostname is preferred to making requests to arbitrary IPs.
    if (/^\d+(?:\.\d+){0,3}$/.test(host) || host.startsWith("[")) return false;
    return true;
  } catch { return false; }
}
function publicCatalogRelevant(title, creator, query) {
  const words = [...new Set(normalizeName(query).split(" ").filter((w) => w.length >= 3))];
  const titleWords = new Set(normalizeName(title).split(" "));
  const artistWords = new Set(normalizeName(creator).split(" "));
  if (!words.length) return false;
  const inTitle = words.filter((w) => titleWords.has(w)).length;
  const covered = words.filter((w) => titleWords.has(w) || artistWords.has(w)).length;
  return inTitle >= 1 && covered / words.length >= (words.length <= 2 ? 1 : 0.67);
}
function openverseFlacCandidate(item) {
  const files = [{ url: item?.url, filetype: item?.filetype },
    ...(Array.isArray(item?.alt_files) ? item.alt_files : [])];
  return files.find((file) => /^(flac|audio\/flac|audio\/x-flac)$/i.test(String(file?.filetype || ""))
    && safePublicAudioUrl(file.url))?.url || null;
}
async function searchOpenverseFlac(query, env, signal = undefined) {
  if (!freeSourceEnabled(env, "OPENVERSE_ENABLED")) return [];
  const cached = cachedPublicTracks("openverse", query);
  if (cached) return cached;
  if (!publicSourceBudget("openverse", 5000, 100)) return [];
  const params = new URLSearchParams({ q: query.slice(0, 180), category: "music",
    extension: "flac", page_size: "12" });
  try {
    const res = await fetchWithTimeout(`https://api.openverse.org/v1/audio/?${params}`,
      { headers: { Accept: "application/json" }, signal }, 1350, "OpenverseSearch");
    if (!res.ok) { notePublicSourceError("openverse", res.status); return []; }
    const data = await res.json();
    if (signal?.aborted) return [];
    const matches = (Array.isArray(data?.results) ? data.results : []).filter((item) =>
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(item?.id || "")) &&
      item?.title && item?.creator && !item?.mature &&
      openverseFlacCandidate(item) && publicCatalogRelevant(item.title, item.creator, query));
    const tracks = matches.slice(0, 7).map((item) => sourceTrack("openverse", String(item.id), {
      title: cleanText(item.title), artist: cleanText(item.creator),
      album: cleanText(item.audio_set?.title || "Openverse"),
      duration: Number(item.duration) > 0 ? Math.round(Number(item.duration) / 1000) : 0,
      artworkURL: item.thumbnail || "", format: "flac", audioQuality: "LOSSLESS",
      attribution: cleanText(item.attribution || ""),
      license: cleanText(item.license || ""),
      licenseURL: item.license_url || "", sourceURL: item.foreign_landing_url || ""
    })).filter(Boolean);
    cachePublicTracks("openverse", query, tracks);
    return tracks;
  } catch (err) { if (err?.status !== 499) console.warn(`[OPENVERSE SEARCH] ${safeError(err)}`); return []; }
}
async function resolveOpenverseFlac(id, env) {
  if (!freeSourceEnabled(env, "OPENVERSE_ENABLED") || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(id))) return null;
  try {
    const res = await fetchWithTimeout(`https://api.openverse.org/v1/audio/${encodeURIComponent(id)}/`,
      { headers: { Accept: "application/json" } }, 1600, "OpenverseDetail");
    if (!res.ok) { notePublicSourceError("openverse", res.status); return null; }
    const entry = await res.json();
    const audioUrl = !entry?.mature && openverseFlacCandidate(entry);
    if (!audioUrl || !(await hasFlacMagic(audioUrl, 1700))) {
      console.warn("[PUBLIC FLAC REJECT] source=openverse reason=signature_or_url");
      return null;
    }
    flacDiagRecord('probe_confirmed', 'openverse', 'confirmed');
    return streamFlacUrl(audioUrl);
  } catch (err) { console.warn(`[OPENVERSE STREAM] ${safeError(err)}`); return null; }
}
function commonsFileData(page) {
  const info = page?.imageinfo?.[0];
  if (!/^File:.*\.flac$/i.test(String(page?.title || ""))) return null;
  if (info?.mime && !/^audio\/(?:x-)?flac$/i.test(info.mime)) return null;
  const direct = info?.url;
  // Commons file URLs must originate from Wikimedia's own upload domain.
  if (!safePublicAudioUrl(direct) || new URL(direct).hostname !== "upload.wikimedia.org"
    || !/\.flac(?:$|[?#])/i.test(direct)) return null;
  return { url: direct, name: page.title.slice(5).replace(/\.flac$/i, "").replace(/_/g, " ") };
}
async function searchCommonsFlac(query, env, signal = undefined) {
  if (!freeSourceEnabled(env, "COMMONS_ENABLED")) return [];
  const cached = cachedPublicTracks("commons", query);
  if (cached) return cached;
  if (!publicSourceBudget("commons", 4000, 150)) return [];
  const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2",
    generator: "search", gsrsearch: `${query.slice(0, 135)} filetype:audio`,
    gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo", iiprop: "url|mime" });
  try {
    const res = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`,
      { headers: { Accept: "application/json" }, signal }, 1500, "CommonsSearch");
    if (!res.ok) { notePublicSourceError("commons", res.status); return []; }
    const data = await res.json();
    if (signal?.aborted) return [];
    const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];
    const tracks = pages.map((page) => {
      const info = commonsFileData(page);
      if (!info || !Number.isSafeInteger(page.pageid) || page.pageid <= 0
        || !publicCatalogRelevant(info.name, "", query)) return null;
      // File name is the closest available name. Commons rarely has reliable
      // standardized music artist+duration metadata, so use a conservative
      // creator label, which won't falsely cross-match a commercial artist.
      // Where a filename explicitly follows "Artist - Song", retain those
      // separate values. Otherwise don't invent a performer from an uploader.
      const parts = info.name.split(/\s+-\s+/).map((part) => part.trim());
      const inferred = parts.length === 2 && parts.every((part) => part.length >= 2);
      return sourceTrack("commons", String(page.pageid), {
        title: cleanText(inferred ? parts[1] : info.name),
        artist: cleanText(inferred ? parts[0] : "Wikimedia Commons (artist uncredited)"),
        album: "Wikimedia Commons", duration: 0,
        sourceURL: `https://commons.wikimedia.org/?curid=${page.pageid}`,
        format: "flac", audioQuality: "LOSSLESS"
      });
    }).filter(Boolean).slice(0, 6);
    cachePublicTracks("commons", query, tracks);
    return tracks;
  } catch (err) { if (err?.status !== 499) console.warn(`[COMMONS SEARCH] ${safeError(err)}`); return []; }
}
async function resolveCommonsFlac(id, env) {
  if (!freeSourceEnabled(env, "COMMONS_ENABLED") || !/^[1-9]\d{0,11}$/.test(String(id))) return null;
  const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2",
    pageids: String(id), prop: "imageinfo", iiprop: "url|mime" });
  try {
    const res = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`,
      { headers: { Accept: "application/json" } }, 1700, "CommonsDetail");
    if (!res.ok) { notePublicSourceError("commons", res.status); return null; }
    const data = await res.json();
    const page = data?.query?.pages?.[0];
    if (page?.pageid !== Number(id)) return null;
    const audioUrl = commonsFileData(page)?.url;
    if (!audioUrl || !(await hasFlacMagic(audioUrl, 1700))) {
      console.warn("[PUBLIC FLAC REJECT] source=commons reason=signature_or_url");
      return null;
    }
    flacDiagRecord('probe_confirmed', 'commons', 'confirmed');
    return streamFlacUrl(audioUrl);
  } catch (err) { console.warn(`[COMMONS STREAM] ${safeError(err)}`); return null; }
}

function searchPersonalFlac(query, env) {
  if (!env?.FLAC_BUCKET) return [];
  const wanted = normalizeName(query);
  if (!wanted) return [];
  return PERSONAL_FLAC_TRACKS.map((t, i) => {
    if (!/\.flac$/i.test(String(t.key || ""))) return null;
    const title = normalizeName(t.title), artist = normalizeName(t.artist);
    const tokens = wanted.split(" ").filter((w) => w.length > 2);
    const combined = `${title} ${artist}`;
    if (!tokens.length || !tokens.every((word) => combined.includes(word))) return null;
    return sourceTrack("personal", String(i), { title: t.title, artist: t.artist,
      album: t.album || "Personal Library", duration: Number(t.duration) || 0,
      format: "flac", audioQuality: "LOSSLESS", artworkURL: t.artworkURL || "" });
  }).filter(Boolean);
}
async function resolvePersonalFlac(id, env, workerOrigin) {
  const i = Number(id);
  const track = PERSONAL_FLAC_TRACKS[i];
  if (!Number.isInteger(i) || !track || !env?.FLAC_BUCKET || !/\.flac$/i.test(track.key)) return null;
  try {
    const object = await env.FLAC_BUCKET.get(track.key, { range: { offset: 0, length: 4 } });
    if (!object?.body) return null;
    const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
    if (bytes.length < 4 || bytes[0] !== 0x66 || bytes[1] !== 0x4c
      || bytes[2] !== 0x61 || bytes[3] !== 0x43) return null;
    return streamFlacUrl(`${workerOrigin}/audio/personal/${i}.flac`);
  } catch { return null; }
}
async function servePersonalFlac(request, env, url) {
  const match = url.pathname.match(/^\/audio\/personal\/(\d+)\.flac$/);
  if (!match || !env?.FLAC_BUCKET) return noStream(404);
  const item = PERSONAL_FLAC_TRACKS[Number(match[1])];
  if (!item || !/\.flac$/i.test(String(item.key || ""))) return noStream(404);
  if (request.method === "OPTIONS") return new Response(null, { status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "Range,Content-Type" } });
  if (!["GET", "HEAD"].includes(request.method)) return noStream(405);
  try {
    const headers = { "Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes", "Cache-Control": "private, no-store",
      "Content-Type": "audio/flac", "Access-Control-Expose-Headers": "Content-Length,Content-Range,Accept-Ranges,ETag" };
    if (request.method === "HEAD") {
      const object = await env.FLAC_BUCKET.head(item.key);
      if (!object) return noStream(404);
      headers["Content-Length"] = String(object.size);
      return new Response(null, { status: 200, headers });
    }
    const range = request.headers.get("Range");
    const object = await env.FLAC_BUCKET.get(item.key, range ? { range: request.headers } : {});
    if (!object) return noStream(404);
    headers["ETag"] = object.httpEtag;
    if (range && object.range && typeof object.range.offset === "number") {
      const begin = object.range.offset;
      const length = object.range.length;
      headers["Content-Range"] = `bytes ${begin}-${begin + length - 1}/${object.size}`;
      headers["Content-Length"] = String(length);
      return new Response(object.body, { status: 206, headers });
    }
    headers["Content-Length"] = String(object.size);
    return new Response(object.body, { status: 200, headers });
  } catch { return noStream(502); }
}

// ============================================================================
// v3.7.5: OPTIONAL, PERSONAL, 36-HOUR FLAC CACHE ON CLOUDFLARE R2
// ============================================================================
// This stores full audio bytes (not just a URL or metadata). The R2 objects have
// metadata for title/artist/duration/expiry. Use only when a source explicitly
// permits temporary storage. All extra provider credentials remain PRIVATE.
// The cache is disabled unless signing secret, R2 binding AND opt-in are set.
const FLAC_CACHE_PREFIX = "bc-flac-cache-v1/";
const FLAC_CACHE_TTL_MS = 36 * 60 * 60 * 1000;
const FLAC_CACHE_MAX_FILE_BYTES = 100 * 1024 * 1024;
const FLAC_CACHE_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

function flacCacheEnabled(env) {
  return freeSourceEnabled(env, "FLAC_CACHE_ENABLED") &&
    !!env?.FLAC_CACHE_BUCKET && String(env?.FLAC_CACHE_SIGNING_KEY || "").length >= 32;
}
function isCacheProviderAllowed(env, provider) {
  const index = /^discord_\d+$/.test(String(provider)) ? Number(String(provider).slice(8)) : null;
  // Retired/reserved or rotating addons cannot write cached audio even if allowlisted.
  if (!flacCacheEnabled(env) || provider === "cache" || provider === "personal" ||
      RETIRED_PROVIDER_INDEXES.has(index) || ROTATING_PROVIDER_INDEXES.has(index)) return false;
  // No default allowlist. Never silently cache from unknown or paid providers.
  const allowed = String(env.FLAC_CACHE_ALLOWED_PROVIDERS || "")
    .split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(provider).toLowerCase());
}
function cacheRecord(meta) {
  // Stable recording identity ignores volatile cross-provider alt/ordering data.
  if (!meta) return null;
  return trackMetadata({ title: meta.title, artist: meta.artist,
    album: meta.album || "", duration: meta.duration });
}
async function flacCacheKey(provider, nativeId, meta) {
  const record = cacheRecord(meta);
  if (!record || !provider || !nativeId) return null;
  const input = `${provider}:${nativeId}:${JSON.stringify(record)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function validCacheId(id) { return /^[a-f0-9]{64}$/.test(String(id)); }
function cacheObjectKey(id) { return `${FLAC_CACHE_PREFIX}${id}.flac`; }
function cacheExpiry(object) {
  const expiry = Number(object?.customMetadata?.expiresAt);
  return Number.isFinite(expiry) ? expiry : 0;
}
function hasValidCacheExpiry(object) {
  return cacheExpiry(object) > Date.now() &&
    cacheExpiry(object) <= Date.now() + FLAC_CACHE_TTL_MS + 120000;
}
async function signCacheUrl(id, exp, env) {
  const secret = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.FLAC_CACHE_SIGNING_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const input = new TextEncoder().encode(`${id}.${exp}`);
  const signature = await crypto.subtle.sign("HMAC", secret, input);
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function validCacheSignature(id, expString, sig, env) {
  if (!validCacheId(id) || !/^\d{10,13}$/.test(String(expString)) ||
      !/^[a-f0-9]{64}$/.test(String(sig || "")) || !flacCacheEnabled(env)) return false;
  const exp = Number(expString);
  if (exp < Date.now() || exp > Date.now() + 12 * 60 * 60 * 1000) return false;
  // WebCrypto constant-time verify rather than direct string comparison.
  const secret = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.FLAC_CACHE_SIGNING_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(sig.match(/../g), (h) => parseInt(h, 16));
  return crypto.subtle.verify("HMAC", secret, bytes, new TextEncoder().encode(`${id}.${exp}`));
}
async function resolveCachedFlac(id, env, origin) {
  if (!flacCacheEnabled(env) || !validCacheId(id)) return null;
  try {
    const object = await env.FLAC_CACHE_BUCKET.head(cacheObjectKey(id));
    if (!object || !hasValidCacheExpiry(object)) return null;
    const exp = Math.min(cacheExpiry(object), Date.now() + 6 * 60 * 60 * 1000);
    const sig = await signCacheUrl(id, exp, env);
    return streamFlacUrl(`${origin}/audio/cache/${id}.flac?exp=${exp}&sig=${sig}`);
  } catch {
    console.warn("[FLAC CACHE SKIP] reason=head_error"); return null;
  }
}
async function serveCachedFlac(request, env, url, ctx) {
  const match = url.pathname.match(/^\/audio\/cache\/([a-f0-9]{64})\.flac$/);
  if (!match || !flacCacheEnabled(env)) return noStream(404);
  if (request.method === "OPTIONS") return new Response(null, { status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "Range,Content-Type" } });
  if (!["GET", "HEAD"].includes(request.method)) return noStream(405);
  const id = match[1];
  if (!(await validCacheSignature(id, url.searchParams.get("exp"), url.searchParams.get("sig"), env)))
    return noStream(403);
  const key = cacheObjectKey(id);
  try {
    const head = await env.FLAC_CACHE_BUCKET.head(key);
    if (!head) return noStream(404);
    if (!hasValidCacheExpiry(head)) {
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(env.FLAC_CACHE_BUCKET.delete(key));
      return noStream(404);
    }
    const headers = { "Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store", "Content-Type": "audio/flac",
      "Access-Control-Expose-Headers": "Content-Length,Content-Range,Accept-Ranges,ETag" };
    headers.ETag = head.httpEtag;
    if (request.method === "HEAD") {
      headers["Content-Length"] = String(head.size);
      return new Response(null, { status: 200, headers });
    }
    const range = request.headers.get("Range");
    const object = await env.FLAC_CACHE_BUCKET.get(key, range ? { range: request.headers } : {});
    if (!object?.body) return noStream(404);
    if (range && object.range && typeof object.range.offset === "number") {
      const begin = object.range.offset;
      const length = object.range.length;
      headers["Content-Range"] = `bytes ${begin}-${begin + length - 1}/${head.size}`;
      headers["Content-Length"] = String(length);
      return new Response(object.body, { status: 206, headers });
    }
    headers["Content-Length"] = String(head.size);
    return new Response(object.body, { status: 200, headers });
  } catch {
    console.warn("[FLAC CACHE SKIP] reason=read_error"); return noStream(502);
  }
}
async function listAllFlacCache(env, maxEntries = 1000) {
  const result = [];
  let cursor;
  do {
    const page = await env.FLAC_CACHE_BUCKET.list({ prefix: FLAC_CACHE_PREFIX,
      limit: Math.min(250, maxEntries - result.length),
      include: ["customMetadata"], ...(cursor ? { cursor } : {}) });
    result.push(...page.objects);
    if (!page.truncated) return { objects: result, truncated: false };
    cursor = page.cursor;
  } while (cursor && result.length < maxEntries);
  return { objects: result, truncated: true }; // fail closed for storage cap
}
async function searchCachedFlac(query, env) {
  if (!flacCacheEnabled(env)) return [];
  const words = normalizeName(query).split(" ").filter((w) => w.length > 2);
  if (!words.length) return [];
  try {
    const page = await listAllFlacCache(env, 500);
    const tracks = [];
    for (const entry of page.objects) {
      if (!hasValidCacheExpiry(entry)) continue;
      const m = entry.customMetadata || {};
      const combined = normalizeName(`${m.title || ""} ${m.artist || ""}`);
      if (!words.every((word) => combined.includes(word))) continue;
      const id = entry.key.slice(FLAC_CACHE_PREFIX.length).replace(/\.flac$/, "");
      if (!validCacheId(id)) continue;
      const track = sourceTrack("cache", id, { title: m.title, artist: m.artist,
        album: m.album || "", duration: Number(m.duration) || 0,
        format: "flac", audioQuality: "LOSSLESS" });
      if (track) tracks.push(track);
      if (tracks.length >= 12) break;
    }
    return tracks;
  } catch {
    console.warn("[FLAC CACHE SKIP] reason=search_error"); return [];
  }
}
// Execute from ctx.waitUntil AFTER giving BitChord the original provider URL.
// Fail safely: no read-response quality downgrade and no incomplete R2 object.
async function saveFlacCache(id, sourceUrl, record, provider, env) {
  if (!isCacheProviderAllowed(env, provider) || !validCacheId(id) ||
      !safePublicAudioUrl(sourceUrl) || !record) return;
  try {
    const existing = await env.FLAC_CACHE_BUCKET.head(cacheObjectKey(id));
    if (existing && hasValidCacheExpiry(existing)) return;
    // Require an explicit Content-Length to avoid streaming unknown-sized or
    // oversized media into R2 and to enforce the small, private 2GB budget.
    const response = await fetch(sourceUrl, { headers: { "Accept-Encoding": "identity" },
      redirect: "follow" });
    if (response.status !== 200 || !response.body) return;
    const length = Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(length) || length < 4 || length > FLAC_CACHE_MAX_FILE_BYTES) {
      console.warn("[FLAC CACHE SKIP] reason=size_unknown_or_exceeds_limit");
      await response.body.cancel(); return;
    }
    if (response.headers.get("content-encoding") &&
        response.headers.get("content-encoding") !== "identity") {
      console.warn("[FLAC CACHE SKIP] reason=compressed_transfer");
      await response.body.cancel(); return;
    }
    const page = await listAllFlacCache(env);
    const now = Date.now();
    const total = page.objects.filter((item) => hasValidCacheExpiry(item))
      .reduce((sum, item) => sum + item.size, 0);
    if (page.truncated || total + length > FLAC_CACHE_MAX_TOTAL_BYTES) {
      console.warn("[FLAC CACHE SKIP] reason=storage_budget");
      await response.body.cancel(); return;
    }
    // Clone only the first few bytes to verify FLAC. Never buffer 100 MB.
    const probe = response.clone();
    const reader = probe.body.getReader();
    const head = [];
    try {
      while (head.length < 4) {
        const item = await reader.read();
        if (item.done) break;
        for (const byte of item.value) {
          head.push(byte); if (head.length === 4) break;
        }
      }
    } finally { try { void reader.cancel().catch(() => {}); } catch {} }
    if (head.length !== 4 || head[0] !== 0x66 || head[1] !== 0x4c ||
        head[2] !== 0x61 || head[3] !== 0x43) {
      console.warn("[FLAC CACHE SKIP] reason=not_flac_bytes");
      await response.body.cancel(); return;
    }
    const info = cacheRecord(record);
    if (!info) { await response.body.cancel(); return; }
    const expiresAt = String(now + FLAC_CACHE_TTL_MS);
    // Some stream transformations lose the body's known length. Use
    // FixedLengthStream in Cloudflare to enforce the validated Content-Length
    // and keep R2.put() streaming rather than allocating a large ArrayBuffer.
    let uploadStream = response.body;
    let pump = Promise.resolve();
    if (typeof FixedLengthStream === "function") {
      const bridge = new FixedLengthStream(length);
      uploadStream = bridge.readable;
      pump = response.body.pipeTo(bridge.writable);
    }
    await env.FLAC_CACHE_BUCKET.put(cacheObjectKey(id), uploadStream, {
      httpMetadata: { contentType: "audio/flac", cacheControl: "private, no-store" },
      customMetadata: { title: info.title, artist: info.artist, album: info.album,
        duration: String(info.duration || 0), provider: String(provider), expiresAt }
    });
    await pump;
    console.log(`[FLAC CACHE SAVED] provider=${provider} ttl_hours=36`);
  } catch {
    console.warn("[FLAC CACHE SKIP] reason=download_or_r2_error");
  }
}
async function cleanExpiredFlacCache(env) {
  if (!flacCacheEnabled(env)) return;
  try {
    const page = await listAllFlacCache(env);
    const now = Date.now();
    const expired = page.objects.filter((o) => cacheExpiry(o) <= now);
    if (expired.length) await env.FLAC_CACHE_BUCKET.delete(expired.map((o) => o.key));
    // Additional storage safety: discard oldest fresh files if over 2 GB.
    const fresh = page.objects.filter((o) => cacheExpiry(o) > now)
      .sort((a, b) => cacheExpiry(a) - cacheExpiry(b));
    let total = fresh.reduce((sum, o) => sum + o.size, 0);
    const evict = [];
    for (const item of fresh) {
      if (total <= FLAC_CACHE_MAX_TOTAL_BYTES) break;
      total -= item.size;
      evict.push(item.key);
    }
    if (evict.length) await env.FLAC_CACHE_BUCKET.delete(evict);
    console.log(`[FLAC CACHE CLEANUP] expired=${expired.length} evicted=${evict.length}`);
    if (page.truncated) console.warn("[FLAC CACHE CLEANUP] remaining_entries_past_1000");
  } catch { console.warn("[FLAC CACHE CLEANUP] reason=r2_error"); }
}

// Keep this opaque layout marker unchanged so recent saved IDs remain compatible.
// The label is historical; no source is configured at reserved index 9.
const TRACK_LAYOUT_ID = "stable10_lb9_2026_10";

// ============================================================================
// CROSS-PROVIDER LOSSLESS RESCUE
// ============================================================================
// Keep enough metadata inside the ID to identify the same recording. The data
// is not a secret or a proof of identity. Newly searched songs receive IDs
// with metadata; older playlist IDs remain playable from the original source.
// Soundtrack metadata is deliberately generic. This also covers games that
// are NOT in the small optional hint list below, provided there are matching
// titles, overlapping composer credits, or strongly matching album+duration.
function trackMetadata(t) {
  if (!t || typeof t !== "object") return null;
  const title = String(t.title || t.name || "").trim().slice(0, 160);
  const artistValue = t.artist || t.artists || t.artistName || t.primaryArtists || "";
  const artist = (Array.isArray(artistValue)
    ? artistValue.map((a) => typeof a === "string" ? a : a?.name || "").join(", ")
    : (typeof artistValue === "object" ? artistValue?.name || "" : String(artistValue))).trim().slice(0, 140);
  const albumValue = t.album || t.albumName || t.albumTitle || t.collectionName || "";
  const album = (typeof albumValue === "object" ? albumValue?.name || albumValue?.title || ""
    : String(albumValue)).trim().slice(0, 125);
  const duration = Number(t.duration ?? t.durationInSeconds ?? (t.durationMs ? t.durationMs / 1000 : 0)) || 0;
  if (!title || !artist || /^(unknown|unknown artist|various artists)$/i.test(artist)) return null;
  return { title, artist, album, duration: duration > 0 && duration < 3000 ? duration : 0 };
}

function encodeMetadata(metadata) {
  const bytes = new TextEncoder().encode(JSON.stringify(metadata));
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unpackTrackId(trackId) {
  const index = trackId.lastIndexOf(METADATA_MARKER);
  if (index < 0) return { nativeId: trackId, metadata: null };
  const nativeId = trackId.slice(0, index);
  const encoded = trackId.slice(index + METADATA_MARKER.length);
  if (!encoded || encoded.length > MAX_ENCODED_TRACK_METADATA_LENGTH) return { nativeId: trackId, metadata: null };
  try {
    const input = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(input);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    const metadata = JSON.parse(new TextDecoder().decode(bytes));
    const validated = trackMetadata(metadata);
    // Never reuse alternate-provider IDs created under an obsolete provider order.
    if (validated && metadata.layout === TRACK_LAYOUT_ID) validated.layout = TRACK_LAYOUT_ID;
    if (validated && validated.layout === TRACK_LAYOUT_ID &&
        /^(?:sl|lb|au)_[0-9a-f]{24}$/.test(String(metadata.session || ''))) validated.session = metadata.session;
    if (validated && metadata.layout === TRACK_LAYOUT_ID &&
        /^pv_[0-9a-f]{24}$/.test(String(metadata.configTag || ''))) validated.configTag = metadata.configTag;
    if (validated && validated.layout === TRACK_LAYOUT_ID && Array.isArray(metadata.alt)) {
      validated.alt = metadata.alt.filter((entry) => Array.isArray(entry) &&
        (entry.length === 2 || (entry.length === 3 && Number.isInteger(entry[0]) &&
          /^pv_[0-9a-f]{24}$/.test(String(entry[2])))) &&
        (Number.isInteger(entry[0]) && entry[0] >= 0 && entry[0] < DISCORD_ADDONS.length ||
        ["jamendo", "ia", "personal", "openverse", "commons", "cache"].includes(entry[0])) &&
        typeof entry[1] === "string" && entry[1].length <= 210).slice(0, MAX_RESULT_ALTERNATIVES);
    }
    return { nativeId, metadata: validated };
  } catch {
    return { nativeId: trackId, metadata: null };
  }
}

// Unicode-aware matching: the earlier ASCII-only normalizer discarded
// Japanese, Chinese and Korean titles entirely, creating false collisions.
// CPU optimization: metadata matching revisits the same track/artist strings
// many times when constructing cross-provider alternatives. Keep a small,
// isolate-local LRU of *short* normalized labels. Never cache audio bytes or URLs.
const NORMALIZED_NAME_CACHE = new Map();
const NORMALIZED_NAME_CACHE_MAX = 640;
function normalizeName(s) {
  const input = String(s || "");
  if (input.length <= 300 && NORMALIZED_NAME_CACHE.has(input)) {
    const cached = NORMALIZED_NAME_CACHE.get(input);
    // Refresh insertion order: a frequently used name survives turnover.
    NORMALIZED_NAME_CACHE.delete(input);
    NORMALIZED_NAME_CACHE.set(input, cached);
    return cached;
  }
  const result = input.normalize("NFKC").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim().replace(/\s+/g, " ");
  if (input.length <= 300) {
    if (NORMALIZED_NAME_CACHE.size >= NORMALIZED_NAME_CACHE_MAX)
      NORMALIZED_NAME_CACHE.delete(NORMALIZED_NAME_CACHE.keys().next().value);
    NORMALIZED_NAME_CACHE.set(input, result);
  }
  return result;
}


// Conservative, curated Japanese ↔ Romaji/English equivalences. No automatic
// Kanji transliteration: one Japanese spelling can have many valid readings.
// Aliases are ONLY one signal; matching still checks version, artist and time.
const TITLE_ALIAS_GROUPS = [
  ["千本桜", "senbonzakura"],
  ["ロミオとシンデレラ", "romeo and cinderella", "romeo to cinderella"],
  ["ワールドイズマイン", "world is mine"],
  ["メルト", "melt"],
  ["ローリンガール", "rolling girl"],
  ["ゴーストルール", "ghost rule"],
  ["ヒバナ", "hibana"],
  // DECO*27 original track, 2023. Do not conflate with the Reloaded recording.
  ["ラビットホール", "rabbit hole", "rabitto hooru", "rabitto horu"],
  ["初音ミクの消失", "the disappearance of hatsune miku", "hatsune miku no shoushitsu"],
  ["砂の惑星", "sand planet", "suna no wakusei"],
  ["シャルル", "charles"],
  ["アイドル", "idol"],
  ["紅蓮華", "gurenge"],
  ["夜に駆ける", "racing into the night", "yoru ni kakeru"],
  ["残酷な天使のテーゼ", "a cruel angel's thesis", "zankoku na tenshi no thesis"]
];
const TITLE_ALIAS_INDEX = new Map();
for (const group of TITLE_ALIAS_GROUPS) {
  const normalized = [...new Set(group.map((name) => normalizeName(name)))];
  for (const name of normalized) TITLE_ALIAS_INDEX.set(name, normalized);
}
function cleanVersionDecorations(title) {
  // Only remove parenthesized versions/credits; versionTags is checked first.
  // Treat English/Japanese catalog decorations identically.
  return normalizeName(String(title || "")
    .replace(/\s*[\(\[【](?:tv(?:\s+|-)?(?:size|ver(?:sion)?)|テレビサイズ|tvサイズ|full(?:\s+|-)?(?:ver(?:sion)?|size)|フル(?:サイズ|ver)?|anime(?:\s+|-)?edit|instrumental|インスト|off\s*vocal|カラオケ|live|ライブ|remix|リミックス|reloaded(?:\s+(?:ver|version))?)[\)\]】]\s*$/iu, " ")
    .replace(/\s+(?:tv(?:\s+|-)?(?:size|ver(?:sion)?)|full(?:\s+|-)?(?:size|ver(?:sion)?)|movie(?:\s+|-)?ver(?:sion)?|instrumental|karaoke|off\s*vocal|live|remix|テレビサイズ|tvサイズ|フルサイズ|ライブ|リミックス|reloaded(?:\s+(?:ver|version))?)\s*$/iu, ""));
}
function titleAliasKeys(name) {
  const normalized = normalizeName(name);
  const base = cleanVersionDecorations(name);
  const variants = new Set([normalized, base]);
  for (const key of [normalized, base]) for (const alias of TITLE_ALIAS_INDEX.get(key) || []) variants.add(alias);
  return [...variants].filter(Boolean);
}
function recoverySearchTitle(title) {
  // A display title such as ラビットホール - Rabbit Hole may not exist verbatim
  // in upstream catalogs. Reuse one existing rescue slot for its curated JP
  // title, without increasing the number of provider requests.
  const parts = curatedBilingualTitleParts(title);
  if (parts) return parts[0];
  const name = cleanVersionDecorations(title);
  const aliases = TITLE_ALIAS_INDEX.get(name) || [];
  // Switch script when possible. This changes existing requests, not request count.
  return aliases.find((alias) => isBilingualPair(name, alias)) || title;
}
const VOICEBANK_ALIASES = new Map([
  ["初音ミク", "hatsune miku"], ["hatsune miku", "hatsune miku"], ["miku hatsune", "hatsune miku"],
  ["鏡音リン", "kagamine rin"], ["kagamine rin", "kagamine rin"],
  ["鏡音レン", "kagamine len"], ["kagamine len", "kagamine len"],
  ["巡音ルカ", "megurine luka"], ["megurine luka", "megurine luka"],
  ["重音テト", "kasane teto"], ["kasane teto", "kasane teto"],
  ["可不", "kafu"], ["kafu", "kafu"], ["flower vocaloid", "v flower"], ["v flower", "v flower"]
]);
// Known producers only; a voicebank is not evidence two productions are the same.
const PRODUCER_ALIASES = new Map([
  ["deco 27", "deco27"], ["deco27", "deco27"],
  ["ryo", "ryo supercell"], ["supercell", "ryo supercell"], ["ryo supercell", "ryo supercell"],
  ["wowaka", "wowaka"], ["現実逃避p", "wowaka"],
  ["黒うさp", "kurousa p"], ["kurousa p", "kurousa p"], ["whiteflame", "kurousa p"],
  ["livetune", "kz livetune"], ["kz livetune", "kz livetune"],
  ["八王子p", "hachioji p"], ["hachioji p", "hachioji p"],
  ["ピノキオピー", "pinocchiop"], ["pinocchiop", "pinocchiop"],
  ["giga", "giga"], ["ギガp", "giga"]
]);
function normalizedCredit(value) {
  const name = normalizeName(value).replace(/^(?:feat|featuring|ft)\s+/i, "");
  return VOICEBANK_ALIASES.get(name) || PRODUCER_ALIASES.get(name) || ARTIST_ALIASES.get(name) || name;
}
// Hoist this immutable lookup instead of allocating an array per credit check.
const VOICEBANK_CANONICAL = new Set(VOICEBANK_ALIASES.values());
function voicebankCredit(credit) { return VOICEBANK_CANONICAL.has(credit); }
function producerCredits(value) { return artistCredits(value).filter((credit) => !voicebankCredit(credit)); }
function voicebankCredits(value) { return artistCredits(value).filter(voicebankCredit); }
function isVocalSynthRecording(meta) {
  const raw = normalizeName(`${meta?.artist || ""} ${meta?.album || ""}`);
  return voicebankCredits(meta?.artist).length > 0 || /(?:vocaloid|ボカロ|synthesizer v|utau|プロセカ|project sekai)/iu.test(raw);
}
function isAnimeSoundtrack(meta) {
  const raw = normalizeName(`${meta?.album || ""} ${meta?.title || ""}`);
  return /(?:anime|アニメ|ost|soundtrack|サウンドトラック|オリジナルサウンドトラック|opening|ending|主題歌|挿入歌|劇場版)/iu.test(raw);
}
// Canonical tags are intentionally conservative. Ignore generic anime OP/ED
// attributions that do not identify a different recording. Reject TV-size,
// movie versions, karaoke, performances, covers and mixes as distinct.
function editionTags(title) {
  const text = normalizeName(title);
  const tags = new Set(versionTags(title).split("|").filter(Boolean));
  const match = (pattern, tag) => { if (pattern.test(text)) tags.add(tag); };
  match(/\b(?:tv size|tv ver|tv version|tv edit|anime edit|short ver|short version|short edit)\b|(?:tvサイズ|テレビサイズ|テレビ版|ショート版)/iu, "tv_size");
  match(/\b(?:full version|full ver|full size|full length)\b|(?:フルサイズ|フルバージョン)/iu, "full_version");
  match(/\b(?:movie ver|movie version|film version|theatrical version)\b|(?:劇場版|映画版)/iu, "movie_version");
  match(/\b(?:off vocal|no vocals|without vocals|instrumental|karaoke)\b|(?:オフボーカル|カラオケ|インスト(?:版)?)/iu, "instrumental");
  match(/\b(?:live|live version|live recording)\b|(?:ライブ|ライヴ)/iu, "live");
  match(/\b(?:cover|cover version)\b|(?:歌ってみた|カバー)/iu, "cover");
  match(/\b(?:remix|remixed|nightcore|sped up|slowed)\b|(?:リミックス|倍速)/iu, "remix");
  match(/\breloaded(?:\s+(?:ver|version))?\b|(?:リローデッド)/iu, "reloaded");
  return [...tags].sort().join("|");
}

// Small registry of ALIAS SPELLINGS, not a claim that these artists are
// identical to their publisher, record label or game studio. Extend safely.
const ARTIST_ALIASES = new Map([
  ["hoyomix", "hoyo mix"],
  ["hoyo mix", "hoyo mix"],
  ["vanguard sound studio", "vanguard sound"],
  ["vanguard sound", "vanguard sound"],
  ["monster siren", "monster siren records"],
  ["monster siren records", "monster siren records"]
]);
function artistIdentity(value) {
  const clean = normalizeName(value);
  return normalizedCredit(clean);
}
function artistCredits(value) {
  const text = String(value || "")
    .replace(/[（(]\s*(?:feat(?:uring)?|ft)\.?\s*/giu, " feat. ")
    .replace(/[）)]/g, " ");
  return [...new Set(text.split(/\s*(?:,|;|、|，|\/|\bfeat(?:uring)?\.?\s*|\bft\.?\s*|\bwith\b|&|\s+x\s+)\s*/iu)
    .map(artistIdentity).filter((name) => name && name !== "various artists"))];
}
function primaryArtist(value) { return artistCredits(value)[0] || ""; }

// Never drop qualifiers that distinguish different recordings.
const VERSION_RE = /\b(extended(?: version| mix)?|album edit|mixed cut|radio edit|radio version|radio mix|single edit|original mix|original version|club mix|kick mix|vip mix|bootleg|instrumental|karaoke|acoustic|live|remix|remastered|remaster|cover|piano version|orchestral version|sped up|slowed|nightcore|demo|re recording|re recorded|trailer version|teaser version|reloaded(?: version| ver)?)\b/giu;
function versionTags(title) {
  return [...new Set([...normalizeName(title).matchAll(VERSION_RE)].map((m) => m[0]))].sort().join("|");
}
function originalMixBase(title) {
  const value = normalizeName(title);
  if (!/\b(?:original mix|original version)$/.test(value)) return null;
  const base = value.replace(/\s+(?:original mix|original version)$/, "").trim();
  return base.length >= 3 ? base : null;
}
const SOUNDTRACK_HINTS = [
  "genshin impact", "honkai", "zenless zone zero", "wuthering waves",
  "arknights", "blue archive", "punishing gray raven", "azur lane",
  "girls frontline", "nikke", "reverse 1999", "fate grand order",
  "project sekai", "granblue fantasy", "limbus company"
];
function looksLikeGameSoundtrack(meta) {
  const text = normalizeName(`${meta?.title || ""} ${meta?.album || ""} ${meta?.artist || ""}`);
  return /\b(ost|soundtrack|game soundtrack|game music)\b/.test(text)
    || SOUNDTRACK_HINTS.some((s) => text.includes(s))
    || ["hoyo mix", "vanguard sound", "monster siren records"].some((s) => artistCredits(meta?.artist).includes(s));
}
function sameAlbum(wanted, candidate) {
  const albumKey = (s) => normalizeName(s)
    .replace(/\b(original|official|video game|game|soundtrack|ost|music from|the)\b/g, " ")
    .trim().replace(/\s+/g, " ");
  const a = albumKey(wanted?.album), b = albumKey(candidate?.album);
  // Generic values such as "OST" are not sufficient evidence.
  return !!(a && a === b && ([...a].length >= 3));
}
function isBilingualPair(a, b) {
  const hasHan = (s) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(s);
  return hasHan(a) !== hasHan(b);
}
// p11: split only KNOWN, equivalent bilingual titles. A random text such as
// "Original - Remix" or "Artist - Song" is never split into match candidates.
// Exact curated alias membership also avoids treating a translated *different*
// song or a different recording edition as interchangeable.
function curatedBilingualTitleParts(title) {
  const raw = String(title || '').normalize('NFKC').trim();
  if (raw.length > 220) return null;
  const separated = raw.match(/^(.{2,110}?)\s*[-–—|｜]\s*(.{2,110})$/u);
  if (!separated || !isBilingualPair(separated[1], separated[2])) return null;
  const leftKey = cleanVersionDecorations(separated[1]);
  const rightKey = cleanVersionDecorations(separated[2]);
  const knownEquivalents = TITLE_ALIAS_INDEX.get(leftKey);
  if (!leftKey || !rightKey || !knownEquivalents?.includes(rightKey)) return null;
  // Never discard a version qualifier present on just one title component.
  if (editionTags(separated[1]) !== editionTags(separated[2])) return null;
  return [separated[1].trim(), separated[2].trim()];
}
function titleVariants(title) {
  const raw = String(title || "").normalize("NFKC").trim();
  const variants = new Set([normalizeName(raw)]);
  // Compare alternate-script Reloaded versions with other Reloaded versions,
  // but editionTags still rejects replacing a normal release with Reloaded.
  if (editionTags(raw).split("|").includes("reloaded")) {
    for (const alias of titleAliasKeys(cleanVersionDecorations(raw))) variants.add(alias);
  }
  // p11: allow curated equivalences separated by a hyphen, dash or vertical
  // bar. Both halves must be in the SAME official-alias group, and version
  // tags must agree, so no generic title shortening occurs here.
  const bilingual = curatedBilingualTitleParts(raw);
  if (bilingual) {
    variants.add(normalizeName(bilingual[0]));
    variants.add(normalizeName(bilingual[1]));
  }
  // Bilingual official titles often include an English translation in brackets.
  // Only interpret the bracket as an alternate title if its script differs.
  const bracket = raw.match(/^(.{2,130}?)\s*[\(\[【]([^()\[\]【】]{2,100})[\)\]】]\s*$/u);
  if (bracket && isBilingualPair(bracket[1], bracket[2])) {
    variants.add(normalizeName(bracket[1]));
    variants.add(normalizeName(bracket[2]));
  }
  // A soundtrack attribution prefix is not part of a track title. Avoid
  // stripping arbitrary artist names or musical version labels.
  const prefix = raw.match(/^(.{2,85}?)\s*(?:[-:|｜])\s*(.{2,140})$/u);
  if (prefix && (looksLikeGameSoundtrack({title: prefix[1]}) || /\b(tune|theme)\b/i.test(prefix[1]))) {
    variants.add(normalizeName(prefix[2]));
  }
  // Expand only curated official-equivalent titles. Each still needs strong
  // artist and version evidence to become a cross-provider candidate.
  for (const part of [...variants]) for (const alias of titleAliasKeys(part)) variants.add(alias);
  return [...variants].filter(Boolean);
}
// p11: Some clients display "Artist — Album" or "Artist — Title" in a
// combined metadata field. Strip that suffix for identity matching ONLY if it
// exactly names a CURATED alias of the recording title, including its edition.
// Leave original metadata untouched and never trim arbitrary artist credits.
function artistForIdentity(artist, title) {
  const raw = String(artist || '').trim();
  const split = raw.match(/^(.{2,110}?)\s+[—–｜]\s+(.{2,100})$/u);
  if (!split) return raw;
  const suffix = split[2].trim();
  const key = normalizeName(suffix);
  if (!TITLE_ALIAS_INDEX.has(key) || editionTags(suffix) !== editionTags(title)) return raw;
  if (!titleVariants(title).includes(key)) return raw;
  return split[1].trim();
}
// v3.7.3: detailed decisions, safe to aggregate without exposing track titles.
// Bare titles may equal an explicitly labeled Original Mix only with both
// durations present (within 2s) and overlapping artist credits.
function recordingMatchDecision(wanted, candidate) {
  const actual = trackMetadata(candidate);
  if (!actual || !wanted?.title || !wanted?.artist) return { ok: false, reason: "missing_metadata" };
  const wantedTags = editionTags(wanted.title);
  const actualTags = editionTags(actual.title);
  const wantedVariants = new Set(titleVariants(wanted.title));
  const actualVariants = titleVariants(actual.title);
  const literalTitleMatch = actualVariants.some((part) => wantedVariants.has(part));
  const wantedBase = originalMixBase(wanted.title);
  const actualBase = originalMixBase(actual.title);
  const validOriginalPair = ((wantedBase && !actualTags && wantedBase === normalizeName(actual.title)) ||
    (actualBase && !wantedTags && actualBase === normalizeName(wanted.title)));
  if (wantedTags !== actualTags && !validOriginalPair)
    return { ok: false, reason: "version_conflict" };
  if (!literalTitleMatch && !validOriginalPair)
    return { ok: false, reason: "title_mismatch" };
  if (wanted.duration && actual.duration && Math.abs(wanted.duration - actual.duration) > (validOriginalPair ? 2 : 5))
    return { ok: false, reason: "duration_mismatch" };
  const wantedArtist = artistForIdentity(wanted.artist, wanted.title);
  const actualArtist = artistForIdentity(actual.artist, actual.title);
  const wantedArtists = new Set(artistCredits(wantedArtist));
  const creditOverlap = artistCredits(actualArtist).some((name) => wantedArtists.has(name));
  if (validOriginalPair && (!wanted.duration || !actual.duration || !creditOverlap))
    return { ok: false, reason: "original_mix_needs_proof" };
  const vocalSynth = isVocalSynthRecording({...wanted, artist: wantedArtist}) ||
    isVocalSynthRecording({...actual, artist: actualArtist});
  if (vocalSynth) {
    const wantedProducers = producerCredits(wantedArtist);
    const actualProducers = producerCredits(actualArtist);
    const sharedProducer = actualProducers.some((p) => wantedProducers.includes(p));
    const wantedVoices = voicebankCredits(wantedArtist);
    const actualVoices = voicebankCredits(actualArtist);
    if (wantedVoices.length && actualVoices.length &&
        !wantedVoices.some((voice) => actualVoices.includes(voice)))
      return { ok: false, reason: "voicebank_conflict" };
    // A matching singer/voicebank alone does not identify the producer.
    if (wantedProducers.length && actualProducers.length && !sharedProducer)
      return { ok: false, reason: "producer_conflict" };
    if ((!wantedProducers.length || !actualProducers.length) && !sharedProducer) {
      if (!(sameAlbum(wanted, actual) && wanted.duration && actual.duration &&
          Math.abs(wanted.duration - actual.duration) <= 2))
        return { ok: false, reason: "vocaloid_producer_unverified" };
    }
  }
  if (creditOverlap) {
    const genericTheme = /^(?:main theme|battle theme|boss theme|boss battle|opening theme|ending theme|title theme|event theme|prologue|epilogue|overture|intro|outro)$/u.test(normalizeName(wanted.title));
    if (genericTheme && (looksLikeGameSoundtrack(wanted) || looksLikeGameSoundtrack(actual))) {
      if (wanted.album && actual.album && !sameAlbum(wanted, actual))
        return { ok: false, reason: "album_mismatch" };
      if (!sameAlbum(wanted, actual) && (!wanted.duration || !actual.duration))
        return { ok: false, reason: "generic_title_ambiguous" };
    }
    return { ok: true, reason: validOriginalPair ? "verified_original_mix" : "matched" };
  }
  // p11: a curated bilingual-title match cannot use album+duration as a
  // substitute for artist identity. This prevents an unrelated cover/producer
  // on the same compilation from being accepted under a translated title.
  if (curatedBilingualTitleParts(wanted.title) || curatedBilingualTitleParts(actual.title))
    return { ok: false, reason: "artist_or_album_mismatch" };
  if (sameAlbum(wanted, actual) && wanted.duration && actual.duration &&
    Math.abs(wanted.duration - actual.duration) <= 3)
    return { ok: true, reason: "album_duration_match" };
  return { ok: false, reason: "artist_or_album_mismatch" };
}
function isSameRecording(wanted, candidate) {
  return recordingMatchDecision(wanted, candidate).ok;
}

// BitChord only asks for Atmos on eligible devices with Dolby enabled. The
// Worker additionally requires ATMOS_ENABLED=true; a spoofed query alone is
// insufficient to turn on this mode.
function wantsAtmos(url, env) {
  return freeSourceEnabled(env, "ATMOS_ENABLED") &&
    String(url.searchParams.get("atmos") || "").toLowerCase() === "auto";
}
function isAtmosTrackClaim(t) {
  if (!t || typeof t !== "object") return false;
  const values = [t.audioMode, ...(Array.isArray(t.audioModes) ? t.audioModes : []),
    t.codec, t.quality, t.audioQuality].map((v) => String(v || "").toLowerCase());
  return t.atmos === true || values.some((v) =>
    /(?:dolby[_ -]?atmos|e[-_]?ac[-_]?3[-_]?joc|eac3[-_]?joc|ec[-_]?3[-_]?joc)/.test(v));
}
// Search eligibility never rewrites a quality badge or proves the audio codec.
function catalogAudioClass(t) {
  if (!t || typeof t !== 'object' || t.encrypted === true || t.encrypted === 'true') return 'incompatible';
  const values = [t.format,t.codec,t.container,t.audioQuality,t.quality].map(v=>String(v || '').toLowerCase());
  if (isAtmosTrackClaim(t) || values.some(v=>/(?:aac|mp3|opus|vorbis|webm|mp4a|e[-_]?ac[-_]?3|eac3|ec[-_]?3|joc|ac[-_]?4|dolby|atmos|alac|mpeg|ogg)/.test(v))) return 'incompatible';
  if (isLosslessTrackClaim(t)) return 'lossless_claim';
  if (values.some(v=>/\b(?:16|24|32)[ -]?bit\b/i.test(v) && /\b\d+(?:\.\d+)?\s*khz\b/i.test(v))) return 'pcm_hint';
  return 'unknown';
}
function isLosslessSearchCandidate(t) {
  const type = catalogAudioClass(t);
  return type !== 'incompatible' && (type === 'lossless_claim' || !!trackMetadata(t));
}
function safeAudioShape(t) {
  const label = v => {
    const text = String(v || '').toLowerCase();
    if (!text) return 'missing';
    if (/\bflac\b/.test(text)) return 'flac';
    if (/dash|mpd/.test(text)) return 'dash_hint';
    if (/hls|m3u8/.test(text)) return 'hls_hint';
    if (/aac|mp3|opus|vorbis|alac|mpeg|ogg/.test(text)) return 'other_codec';
    if (text === 'none') return 'none';
    if (/lossless/.test(text)) return 'lossless_claim';
    return 'other';
  };
  return {format:label(t?.format),codec:label(t?.codec),container:label(t?.container),
    manifest:label(t?.manifest),quality_class:catalogAudioClass(t),
    has_url:typeof t?.url === 'string',encrypted:t?.encrypted===true || t?.encrypted==='true'};
}
function isLosslessTrackClaim(t) {
  if (!t || typeof t !== "object") return false;
  const vals = [t.format, t.codec, t.container, t.audioQuality, t.quality]
    .map((v) => String(v || "").toLowerCase());
  if (isAtmosTrackClaim(t) || vals.some((v) =>
    /(?:aac|mp3|opus|vorbis|webm|mp4a|e[-_]?ac[-_]?3|eac3|ec[-_]?3|joc|ac[-_]?4|dolby|atmos|alac|mpeg|ogg)/.test(v))) return false;
  return vals.some((v) => v.includes("flac") || v.includes("lossless"));
}
function isFlacStream(t) {
  if (!t || !isPlayableUrl(t.url) || t.encrypted === true || t.encrypted === "true") return false;
  const flags = [t.format, t.codec, t.container, t.mimeType, t.mime_type,
    t.manifest, t.audioMode, ...(Array.isArray(t.audioModes) ? t.audioModes : [])]
    .map((v) => String(v || "").toLowerCase());
  // Any explicit conflicting codec invalidates a nominal FLAC claim. In
  // particular 'ec-3' without 'joc' is still NOT FLAC (v3.7.5 bug fix).
  if (t.atmos === true || flags.some((v) =>
    /(?:aac|mp3|opus|vorbis|webm|mp4a|e[-_]?ac[-_]?3|eac3|ec[-_]?3|joc|ac[-_]?4|dolby|atmos|alac|mpeg|ogg)/.test(v))) return false;
  if (flags.some((v) => /(?:hls|dash|m3u8|mpd)/.test(v))) return false;
  try {
    const url = new URL(t.url);
    if (/(^|\.)(youtube\.com|youtu\.be|googlevideo\.com|youtube-nocookie\.com)$/.test(url.hostname.toLowerCase())) return false;
    const path = decodeURIComponent(url.pathname).toLowerCase();
    if (/\.(opus|webm|mp3|m4a|mp4|aac|ogg|m3u8|mpd|ec3|eac3)$/.test(path)) return false;
    const explicit = flags.some((v) => /\bflac\b/.test(v));
    return explicit || path.endsWith(".flac");
  } catch { return false; }
}
// E-AC-3 JOC is Dolby Digital Plus Atmos, not lossless FLAC. Explicit JOC
// identification is required: ordinary ec-3 alone is NOT enough.
function isAtmosStream(t) {
  if (!t || !isPlayableUrl(t.url) || t.encrypted === true || t.encrypted === "true") return false;
  const codec = String(t.codec || "").toLowerCase().replace(/[_\s]/g, "-");
  if (!/(?:^|\b)(?:e-?ac-?3|eac3|ec-?3)-joc(?:$|\b)/.test(codec)) return false;
  const flags = [t.format, t.container, t.mimeType, t.mime_type]
    .map((v) => String(v || "").toLowerCase());
  if (flags.some((v) => /(?:flac|alac|aac|mp3|opus|webm)/.test(v))) return false;
  const manifest = String(t.manifest || "none").toLowerCase();
  if (!["none", "hls", "dash"].includes(manifest)) return false;
  try {
    const path = decodeURIComponent(new URL(t.url).pathname).toLowerCase();
    if (/\.(flac|mp3|aac|opus|webm)$/.test(path)) return false;
    if (manifest === "none" && /\.(mpd|m3u8)$/.test(path)) return false;
    return true;
  } catch { return false; }
}
function isAllowedStream(stream, wantAtmos) {
  return isFlacStream(stream) || (wantAtmos && isAtmosStream(stream));
}
function normalizeAtmosStream(stream) {
  const { _resolvedProvider, bitDepth, ...fields } = stream;
  const manifest = String(stream.manifest || "none").toLowerCase();
  return { ...fields, format: stream.format || (manifest !== "none" ? manifest : "eac3"),
    codec: "eac3-joc", container: stream.container || "mp4", manifest,
    quality: "Dolby Atmos", audioMode: "DOLBY_ATMOS", atmos: true, encrypted: false };
}
// Some upstreams label a radio/album edit as "Original Mix". When the
// resolver explicitly includes stream duration, reject mismatched recordings.
// This is a metadata check, NOT audio fingerprinting or FLAC byte inspection.
function streamDurationSeconds(stream) {
  if (!stream || typeof stream !== "object") return 0;
  const seconds = Number(stream.durationInSeconds ?? stream.durationSeconds ?? stream.duration);
  if (Number.isFinite(seconds) && seconds > 0 && seconds <= 3000) return seconds;
  const milliseconds = Number(stream.durationMs);
  if (Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 3000000) return milliseconds / 1000;
  return 0;
}
function streamMatchesExpectedDuration(stream, expectedDuration) {
  if (!(Number(expectedDuration) > 0)) return true;
  const actual = streamDurationSeconds(stream);
  return !(actual > 0 && Math.abs(actual - Number(expectedDuration)) > 5);
}

function streamMatchesExpectedIdentity(stream, expected) {
  // Never confuse codec verification with recording identity. A provider may
  // return a valid FLAC URL for the wrong song. Check all available fields.
  if (!stream || !expected) return true;
  if (!streamMatchesExpectedDuration(stream, expected.duration)) return false;
  const title = String(stream.title || stream.name || '').trim();
  // Upstream artist metadata may be a string, object, or array. Preserve its
  // original shape for trackMetadata() rather than stringifying an object.
  const artist = stream.artist ?? stream.artists ?? stream.artistName ?? stream.primaryArtists;
  const hasArtist = Array.isArray(artist) ? artist.length > 0
    : artist && typeof artist === 'object' ? Boolean(artist.name)
    : Boolean(String(artist || '').trim());
  if (title && hasArtist) return recordingMatchDecision(expected, { ...stream, title, artist }).ok;
  if (title && expected.title) {
    // When no artist is supplied, insist on clear title/version identity.
    // Do NOT accept a generic / original-mix alias with missing credits.
    if (editionTags(title) !== editionTags(expected.title)) return false;
    const matches = new Set(titleVariants(expected.title));
    if (!titleVariants(title).some(part => matches.has(part))) return false;
  }
  return true;
}

function normalizeFlacStream(stream) {
  const { _resolvedProvider, ...publicFields } = stream;
  return { ...publicFields, format: "flac", codec: "flac", container: "flac", mimeType: "audio/flac", mime_type: "audio/flac", manifest: "none", encrypted: false };
}
function noStream(status) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

// Search once, share verified same-recording candidates with the stream call.
// This removes the biggest source of delays in the previous implementation.
function sourceRank(provider) {
  if (provider === "cache") return -20;
  if (provider === "personal") return 0;
  if (provider === "openverse") return 85;
  if (provider === "commons") return 88;
  if (provider === "jamendo") return 70;
  if (provider === "ia") return 80;
  const m = String(provider).match(/^discord_(\d+)$/);
  return m ? preferredRank(Number(m[1])) : 1000;
}
function sourceEnabled(provider, env) {
  if (provider === "cache") return flacCacheEnabled(env);
  if (provider === "jamendo") return !!getJamendoClientId(env);
  if (provider === "ia") return !!FALLBACK_SOURCES.IA_ENABLED;
  if (provider === "personal") return !!env?.FLAC_BUCKET;
  if (provider === "openverse") return freeSourceEnabled(env, "OPENVERSE_ENABLED");
  if (provider === "commons") return freeSourceEnabled(env, "COMMONS_ENABLED");
  const match = String(provider).match(/^discord_(\d+)$/);
  return !!(match && configuredAddonUrl(Number(match[1]), env));
}
async function addKnownAlternatives(tracks, env = {}) {
  // Only changed provider endpoints need fingerprinting. Track matching
  // itself stays synchronous, with no digest per candidate pair.
  const configTags = new Map();
  for (let index = 0; index <= 8; index++) {
    const url = configuredAddonUrl(index, env);
    if (providerUsesChangedManifest(index, url))
      configTags.set(index, await providerManifestTag(index, url));
  }
  const originals = tracks.map((t) => {
    const fullId = String(t.id || "");
    const sep = fullId.indexOf(":");
    if (sep < 0) return null;
    const provider = fullId.slice(0, sep);
    if (!/^discord_\d+$/.test(provider) && !["jamendo", "ia", "personal", "openverse", "commons", "cache"].includes(provider)) return null;
    const decoded = unpackTrackId(fullId.slice(sep + 1));
    return { item: t, provider, nativeId: decoded.nativeId, meta: decoded.metadata,
      matchMeta: trackMetadata(t), lossless: isLosslessSearchCandidate(t) };
  });
  // A large search batch can contain dozens of unrelated tracks. Comparing
  // recordings differing by >5s cannot pass recordingMatchDecision, including
  // Original Mix (which requires an even tighter 2s tolerance). Filter these
  // pairs before expensive Unicode/artist/version matching.
  return tracks.map((track, position) => {
    const origin = originals[position];
    if (!origin?.meta) return track;
    const alternatives = [];
    for (const target of originals) {
      if (!target || target.provider === origin.provider || !target.meta || !target.lossless) continue;
      // A song title and artist alone can point to another master or edit.
      // Never cache an alternate without both track durations.
      if (!(origin.meta.duration > 0 && target.meta.duration > 0)) continue;
      if (target.matchMeta?.duration &&
          Math.abs(origin.meta.duration - target.matchMeta.duration) > 5) continue;
      // Compare the same top-level source metadata as before, but only parse
      // it once per search result instead of once per O(n²) candidate pair.
      if (!isSameRecording(origin.meta, target.matchMeta)) continue;
      if (target.nativeId.length > 210 || target.nativeId.length < 1) continue;
      const normalizedProvider = target.provider.startsWith("discord_") ? Number(target.provider.slice(8)) : target.provider;
      if (!sourceEnabled(target.provider, env) || ROTATING_PROVIDER_INDEXES.has(normalizedProvider)) continue;
      // Retired/reserved sources and rotating IDs never become saved alternates.
      if (alternatives.some((a) => a[0] === normalizedProvider)) continue;
      const tag = typeof normalizedProvider === 'number' ? configTags.get(normalizedProvider) : null;
      alternatives.push(tag ? [normalizedProvider, target.nativeId, tag] : [normalizedProvider, target.nativeId]);
    }
    alternatives.sort((a, b) => sourceRank(typeof a[0] === "number" ? `discord_${a[0]}` : a[0])
      - sourceRank(typeof b[0] === "number" ? `discord_${b[0]}` : b[0]));
    const packed = { ...origin.meta, alt: alternatives.slice(0, MAX_RESULT_ALTERNATIVES) };
    const id = `${origin.provider}:${origin.nativeId}${METADATA_MARKER}${encodeMetadata(packed)}`;
    return id.length <= 1900 ? { ...track, id } : track;
  });
}
async function findMatchingFlacStream(wanted, primaryProvider, quality, atmos, started, env, workerOrigin) {
  const deadline = started + MAX_RESCUE_DURATION_MS;
  flacDiagRecord("rescue_start");
  const seen = new Set();
  function cleanCandidates(incoming) {
    return incoming.filter(({ provider, nativeId }) => {
      if (provider === primaryProvider || !sourceEnabled(provider, env) ||
        typeof nativeId !== "string" || !nativeId || nativeId.length > 210) return false;
      const key = `${provider}:${nativeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const match = provider.match(/^discord_(\d+)$/);
      if (match && streamRecentlyFailed(Number(match[1]), nativeId)) return false;
      return true;
    }).sort((a, b) => {
      const ac = providerIsCooling(a.provider), bc = providerIsCooling(b.provider);
      return Number(ac) - Number(bc) || sourceRank(a.provider) - sourceRank(b.provider);
    });
  }
  function providerIsCooling(provider) {
    const m = provider.match(/^discord_(\d+)$/);
    return !!(m && providerCooling(Number(m[1]), "stream"));
  }
  async function resolveCandidate(candidate, timeout) {
    const { provider, nativeId } = candidate;
    if (provider.startsWith("discord_")) {
      const index = Number(provider.slice(8));
      const baseUrl = configuredAddonUrl(index, env);
      // FLAC rescue must never inherit the primary Atmos opt-in hint.
      // Otherwise the upstream may choose a JOC rendition that FLAC-only
      // verification correctly rejects, even when stereo FLAC is available.
      return baseUrl ? resolveDiscordAddon(baseUrl, nativeId, quality, "", index, false, timeout, false, env, deadline, wanted) : null;
    }
    if (provider === "jamendo") return resolveJamendoFlac(nativeId, env, wanted);
    if (provider === "ia") return resolveArchiveFlac(nativeId);
    if (provider === "personal") return resolvePersonalFlac(nativeId, env, workerOrigin);
    if (provider === "openverse") return resolveOpenverseFlac(nativeId, env);
    if (provider === "commons") return resolveCommonsFlac(nativeId, env);
    if (provider === "cache") return resolveCachedFlac(nativeId, env, workerOrigin);
    return null;
  }
  async function resolveCandidateBatch(candidates, label) {
    const remaining = deadline - Date.now();
    if (remaining < 500 || !candidates.length) return null;
    // Don't retry providers with a current stream cooldown: doing so consumes
    // the limited playback deadline and worsens 429/502 responses.
    const usable = candidates.filter(({ provider }) => !providerIsCooling(provider))
      .slice(0, MAX_RESCUE_TOTAL_CANDIDATES);
    if (!usable.length) {
      console.warn(`[FLAC RESCUE SKIP] phase=${label} reason=providers_cooling candidates=${candidates.length}`);
      return null;
    }
    for (let offset = 0; offset < usable.length; offset += MAX_FALLBACK_STREAMS) {
      const remaining = deadline - Date.now();
      if (remaining < 700) break;
      const pool = usable.slice(offset, offset + MAX_FALLBACK_STREAMS);
      // Reserve the verification window inside the same rescue deadline.
      // Fewer serial rounds; up to three candidates raced in each round.
      const verifyBudget = flacProbeTimeoutMs(env);
      const timeout = Math.min(STREAM_TIMEOUT_MS, Math.max(400, remaining - verifyBudget - 100));
      console.log(`[FLAC RESCUE ${label}] candidates=${pool.length} round=${Math.floor(offset / MAX_FALLBACK_STREAMS) + 1} budget_ms=${remaining}`);
      const rejectionCounts = Object.create(null);
      try {
        // First byte-verified, identity-matched FLAC wins. Competing failures
        // are categorized without printing native IDs, manifest URLs or tokens.
        const winner = await Promise.any(pool.map(async (candidate) => {
          try {
            const data = await resolveCandidate(candidate, timeout);
            if (!data) throw new Error("no_verified_stream");
            if (!isFlacStream(data)) throw new Error("non_flac_stream");
            if (!streamMatchesExpectedIdentity(data, wanted)) {
              console.warn(`[REJECTED WRONG RECORDING] provider=${candidate.provider} phase=${label}`);
              throw new Error("wrong_recording_identity");
            }
            return { ...normalizeFlacStream(data), _resolvedProvider: candidate.provider };
          } catch (error) {
            const reason = ["no_verified_stream", "non_flac_stream", "wrong_recording_identity"]
              .includes(error?.message) ? error.message : "resolver_error";
            rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
            throw new Error(reason);
          }
        }));
        flacDiagRecord("rescue_success", winner._resolvedProvider);
        console.log(`[FLAC RESCUE SUCCESS] provider=${winner._resolvedProvider}`);
        return winner;
      } catch {
        const reasons = Object.entries(rejectionCounts).map(([reason, count]) => `${reason}:${count}`).join(',') || 'none';
        console.warn(`[FLAC RESCUE BATCH FAILED] phase=${label} attempted=${pool.length} reasons=${reasons}`);
      }
    }
    return null;
  }

  // Old saved alternatives must not be replayed against a changed manifest.
  // A new alternate has an embedded stamp; old two-cell entries remain
  // eligible when the provider is still using its previous endpoint.
  const knownAlternatives = [];
  for (const [index, nativeId, priorConfigTag] of (wanted.alt || [])) {
    if (typeof index === 'number' && ROTATING_PROVIDER_INDEXES.has(index)) continue;
    if (typeof index === 'number') {
      const currentUrl = configuredAddonUrl(index, env);
      const changed = providerUsesChangedManifest(index, currentUrl);
      if (changed && priorConfigTag !== await providerManifestTag(index, currentUrl)) continue;
      if (!changed && priorConfigTag) continue;
    }
    const altProvider = typeof index === 'number' ? `discord_${index}` : index;
    if (!sourceEnabled(altProvider, env)) continue;
    knownAlternatives.push({ provider: altProvider, nativeId });
  }
  const cached = cleanCandidates(knownAlternatives.filter((candidate) =>
    !ROTATING_PROVIDER_INDEXES.has(Number(String(candidate.provider).slice(8)))));
  // Never reuse rotating-provider native IDs from older sessions.
  if (cached.length) {
    const found = await resolveCandidateBatch(cached, "CACHED");
    if (found) return found;
  }
  let remaining = deadline - Date.now();
  if (remaining < 2200) {
    flacDiagRecord("rescue_exhausted", "system", "deadline");
    console.warn(`[FLAC RESCUE EXHAUSTED] reason=deadline remaining_ms=${Math.max(0, remaining)}`);
    return null;
  }
  const available = DISCORD_ADDONS.map((_, index) => ({ url: configuredAddonUrl(index, env), index }))
    .filter(({ url, index }) => url && `discord_${index}` !== primaryProvider
      && !providerCooling(index, "search") && !providerCooling(index, "stream"))
    .sort((a, b) => preferredRank(a.index) - preferredRank(b.index));
  const previousProviders = new Set(knownAlternatives.map(({ provider }) => provider));
  const untried = available.filter(({ index }) => !previousProviders.has(`discord_${index}`));
  const sources = (untried.length ? untried : available).slice(0, 4);
  console.log(`[PROVIDER PRIORITY] phase=rescue order=${sources.map(({ index }) => `discord_${index}`).join(",") || "none"} evidence=verified_flac_and_recent_health`);
  const searchTimeout = Math.min(RESCUE_SEARCH_TIMEOUT_MS, remaining - 1700);
  if (searchTimeout < 450) { flacDiagRecord("rescue_exhausted", "system", "deadline"); return null; }
  // For game/anime soundtracks, some catalogs index tracks under the game or
  // composer rather than the collective artist. Distribute two query shapes
  // across the SAME four upstream slots, not eight requests in a row.
  const soundtrack = looksLikeGameSoundtrack(wanted) || isAnimeSoundtrack(wanted) || isVocalSynthRecording(wanted);
  const compactTitle = wanted.title; // Preserve original script/capitalization for upstream text search.
  const alternateTitle = recoverySearchTitle(wanted.title);
  const queries = sources.map((source, slot) => ({
    ...source,
    // Reuse four existing requests: alternate Japanese/Romaji title takes an
    // existing query slot, never introduces an additional serial provider call.
    query: slot % 2 === 1 && alternateTitle !== compactTitle
      ? alternateTitle
      : slot % 2 === 1 ? compactTitle
        : slot % 4 === 2 ? `${wanted.artist} ${wanted.title}`
          : `${wanted.title} ${wanted.artist}`
  }));
  if (alternateTitle !== compactTitle) console.log("[JP ALIAS DISCOVERY] alternate_script_query=true");
  if (soundtrack) console.log(`[OST DISCOVERY] query_modes=artist_and_title_or_title_only providers=${queries.length}`);
  else console.log(`[RESCUE DISCOVERY] query_modes=full_and_title_only providers=${queries.length} strict_identity=true`);
  const discovery = queries.map(({ url, index, query }) =>
    searchDiscordAddon(url, index, query, searchTimeout));
  // A free Jamendo read API client ID enables it as a recovery source.
  if (getJamendoClientId(env) && primaryProvider !== "jamendo")
    discovery.push(searchJamendo(`${wanted.title} ${wanted.artist}`, env, searchTimeout));
  // Cached tracks can rescue a stream even if the original catalog is down.
  if (flacCacheEnabled(env) && primaryProvider !== "cache")
    discovery.push(searchCachedFlac(`${wanted.title} ${wanted.artist}`, env));
  // Last-resort free catalog discovery for unresolved tracks. These remain
  // opt-in and have independent per-isolate request caps.
  if (primaryProvider !== "openverse" && freeSourceEnabled(env, "OPENVERSE_ENABLED"))
    discovery.push(searchOpenverseFlac(`${wanted.title} ${wanted.artist}`, env));
  if (primaryProvider !== "commons" && freeSourceEnabled(env, "COMMONS_ENABLED"))
    discovery.push(searchCommonsFlac(`${wanted.title} ${wanted.artist}`, env));
  const results = await Promise.allSettled(discovery);
  const candidates = [];
  let checkedLossless = 0, rejectedMatch = 0;
  const reasons = Object.create(null);
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const track of result.value) {
      if (!isLosslessSearchCandidate(track)) continue;
      checkedLossless++;
      // Fail closed on ambiguous search-only rescues: a matched name without
      // durations is not enough evidence to replace a recording.
      const decision = !(wanted.duration > 0 && trackMetadata(track)?.duration > 0)
        ? {ok:false,reason:"rescue_duration_unavailable"}
        : recordingMatchDecision(wanted, track);
      reasons[decision.reason] = (reasons[decision.reason] || 0) + 1;
      if (!decision.ok) { rejectedMatch++; continue; }
      const sep = String(track.id).indexOf(":");
      const provider = String(track.id).slice(0, sep);
      const { nativeId } = unpackTrackId(String(track.id).slice(sep + 1));
      candidates.push({ provider, nativeId });
    }
  }
  const fresh = cleanCandidates(candidates);
  if (soundtrack) console.log(`[OST MATCH] lossless_claims=${checkedLossless} rejected_metadata=${rejectedMatch} candidates=${fresh.length}`);
  const compactReasons = Object.entries(reasons).sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name}:${count}`).join(",") || "none";
  console.log(`[MATCH REASONS] checked=${checkedLossless} rejected=${rejectedMatch} reasons=${compactReasons}`);
  for (const [reason, amount] of Object.entries(reasons)) {
    if (reason !== "album_duration_match") flacDiagRecord("identity_rejected", "system", flacDiagReason(reason), amount);
  }
  // Mismatches aren't proof that available FLAC was overlooked. Strict artist,
  // duration, and release/version checks remain in place. Log categories only.
  if (!fresh.length) {
    flacDiagRecord("rescue_exhausted", "system", "no_fresh_match");
    console.warn(`[FLAC RESCUE EXHAUSTED] reason=no_fresh_match searched=${discovery.length}`);
    return null;
  }
  const resolved = await resolveCandidateBatch(fresh, "FRESH");
  if (!resolved) { flacDiagRecord("rescue_exhausted", "system", "all_candidates_failed"); console.warn(`[FLAC RESCUE EXHAUSTED] reason=all_candidates_failed`); }
  return resolved;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function isPlayableUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function safeError(err) {
  // Don't log signed provider URLs, bearer tokens, or sensitive query strings.
  const message = String(err?.message || "unknown_error");
  return /^[a-z0-9_]+$/i.test(message) ? message : "upstream_error";
}

function getQualityScore(track) {
  let score = 0;
  if (String(track.id).startsWith("discord_")) score += 10;
  if (String(track.id).startsWith("personal:")) score += 18;
  if (track.audioQuality === "LOSSLESS" || track.format === "flac") score += 20;
  else if (track.audioQuality === "HIGH") score += 5;
  return score;
}

function cleanText(str) {
  return String(str)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'");
}

function json(value, cacheAge = 0) {
  const headers = {
    "Access-Control-Allow-Origin": "*"
  };
  
  if (cacheAge > 0) {
    headers["Cache-Control"] = `public, max-age=${cacheAge}, s-maxage=${cacheAge}`;
  } else {
    headers["Cache-Control"] = "no-store";
  }
  
  return Response.json(value, { headers });
}
// Manual, authenticated checks. One source and at most two stream candidates per request.
// Does not record success in playback counters or change normal provider cooldowns.
const SOURCE_CHECK_LAST = new Map();
async function sourceCheckAuthorized(request, env) {
  const secret = String(env.SOURCE_CHECK_TOKEN || '');
  if (secret.length < 32) return false;
  const supplied = (request.headers.get('Authorization') || '').replace(/^Bearer /,'');
  if (!supplied || supplied.length > 512) return false;
  const digest = s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  const [a,b] = await Promise.all([digest(secret),digest(supplied)]);
  const x=new Uint8Array(a), y=new Uint8Array(b); let difference=0;
  for(let i=0;i<x.length;i++) difference |= x[i]^y[i];
  return difference===0;
}
async function sourceCheckJson(address, ms=6000) {
  const deadline=Date.now()+ms;
  const response=await fetchWithTimeout(address,{headers:{Accept:'application/json'}},ms,'SourceCheck',0);
  if (!response.ok) {
    try { void response.body?.cancel().catch(()=>{}); } catch {}
    return {http:response.status,data:null};
  }
  try {return {http:response.status,data:await readJsonWithinDeadline(response,deadline)};}
  catch(err) {return {http:response.status,data:null,error:err?.status===504?'body_timeout':'invalid_json'};}
}
async function checkAddonSource(index, query, env) {
  const provider=`discord_${index}`;
  if (RETIRED_PROVIDER_INDEXES.has(index)) return {provider,status:'retired',streamability:'not_tested'};
  const endpoint=configuredAddonUrl(index,env);
  if (!endpoint) return {provider,status:'disabled_or_missing_valid_configuration',streamability:'not_tested'};
  const base=addonEndpointKey(endpoint);
  const report={provider,status:'checking',configuration:'deployed',streamability:'not_tested'};
  try {
    // Manifest availability alone never proves playback; search is attempted independently.
    try {
      const m=await sourceCheckJson(`${base}/manifest.json`,4000);
      report.manifest={http:m.http,json:!!m.data,error:m.error || null};
    } catch(err) {report.manifest={error:err?.status===504?'timeout':'network_error'};}
    const params=new URLSearchParams({q:query});if(index===10) params.set('quality','max');
    const r=await sourceCheckJson(`${base}/search?${params}`,6000);
    report.search={http:r.http,error:r.error || null};
    if(!r.data) {report.status='search_failed';return report;}
    if(!Array.isArray(r.data.tracks)) {report.status='unsupported_search_schema';return report;}
    const tracks=r.data.tracks;
    report.search.count=tracks.length;
    report.search.audio_classes={lossless_claim:0,pcm_hint:0,unknown:0,incompatible:0};
    for(const t of tracks) report.search.audio_classes[catalogAudioClass(t)]++;
    // Prefer a query-relevant sample; do not present unrelated results as a successful test.
    const candidates=tracks.filter(t=>isLosslessSearchCandidate(t) && trackMetadata(t) &&
      (typeof t.id==='string'||typeof t.id==='number') && String(t.id).length<500 &&
      simplifiedResultMatchesOriginal(t,query)).slice(0,2);
    if(!candidates.length) {report.status=tracks.length?'no_eligible_query_match':'no_results_for_query';return report;}
    report.samples=[];
    for(const t of candidates) {
      const sample={search_audio_class:catalogAudioClass(t)};
      report.samples.push(sample);
      try {
        const r=await sourceCheckJson(`${base}/stream/${encodeURIComponent(String(t.id))}?quality=${index===10?'max':'lossless'}`,6000);
        sample.http=r.http;
        if(!r.data) {sample.result=r.error || 'stream_http_error';continue;}
        sample.response_shape=safeAudioShape(r.data);
        const stream=unwrapClearFlacManifest(r.data);
        if(!streamMatchesExpectedIdentity(stream,trackMetadata(t))) {sample.result='identity_mismatch';continue;}
        const issue=flacProbeCandidateIssue(stream);
        if(issue) {sample.result=issue;continue;}
        const diagnostic={};
        const verdict=await probeExternalFlac(stream.url,2500,diagnostic);
        sample.result=verdict===true?'verified_native_flac':verdict===false?'non_flac_bytes':'inconclusive';
        sample.probe_reason=flacDiagReason(diagnostic.reason);
        if(verdict===true) {
          report.status='sample_verified';report.streamability='verified_native_flac_sample';return report;
        }
      } catch(err) {sample.result=err?.status===504?'timeout':'network_or_response_error';}
    }
    report.status='samples_not_verified';report.streamability='unconfirmed';return report;
  } catch(err) {report.status=err?.status===504?'search_timeout':'network_or_response_error';return report;}
}
async function checkBuiltinSource(provider, query, env, origin) {
  const report={provider,configuration:'deployed',status:'checking',streamability:'not_tested'};
  if(!sourceEnabled(provider,env)) return {...report,status:'disabled_or_missing_configuration'};
  try {
    const searches={
      jamendo:()=>searchJamendo(query,env,5000), ia:()=>searchArchiveFlac(query),
      openverse:()=>searchOpenverseFlac(query,env), commons:()=>searchCommonsFlac(query,env),
      personal:()=>searchPersonalFlac(query,env), cache:()=>searchCachedFlac(query,env)
    };
    const tracks=await searches[provider]();report.search_results=tracks.length;
    const track=tracks.find(t=>trackMetadata(t) && simplifiedResultMatchesOriginal(t,query));
    if(!track) return {...report,status:tracks.length?'no_eligible_query_match':'no_results_or_upstream_unavailable'};
    const full=String(track.id);const id=unpackTrackId(full.slice(full.indexOf(':')+1)).nativeId;
    const resolvers={
      jamendo:()=>resolveJamendoFlac(id,env,trackMetadata(track)), ia:()=>resolveArchiveFlac(id),
      openverse:()=>resolveOpenverseFlac(id,env), commons:()=>resolveCommonsFlac(id,env),
      personal:()=>resolvePersonalFlac(id,env,origin), cache:()=>resolveCachedFlac(id,env,origin)
    };
    const stream=await resolvers[provider]();
    if(!stream) return {...report,status:'sample_unavailable'};
    if(provider==='cache') {
      // Cached object HEAD/expiry is not fresh byte proof.
      return {...report,status:'cached_object_present',streamability:'cached_object_not_reprobed'};
    }
    // Native resolver has already verified bytes. No arbitrary lossy resolver is called.
    return {...report,status:'sample_verified',streamability:'verified_native_flac_sample'};
  } catch {return {...report,status:'check_error'};}
}
async function sourceCheckResponse(request,env) {
  const headers={'Cache-Control':'private, no-store','Content-Type':'application/json'};
  if(!env.SOURCE_CHECK_TOKEN) return new Response(null,{status:404,headers});
  if(!await sourceCheckAuthorized(request,env)) return Response.json({error:'unauthorized'},{status:401,headers});
  if(request.method!=='POST') return new Response(null,{status:405,headers});
  let body;
  try {body=await readJsonWithinDeadline(request,Date.now()+1500,undefined,4096);}
  catch {return Response.json({error:'invalid_request'},{status:400,headers});}
  const provider=String(body?.provider || '');const query=String(body?.query || '').trim();
  const addon=/^discord_(\d+)$/.exec(provider);
  if(!(addon && Number(addon[1])<DISCORD_ADDONS.length) &&
      !['jamendo','ia','openverse','commons','personal','cache'].includes(provider))
    return Response.json({error:'invalid_provider'},{status:400,headers});
  if(query.length<2 || query.length>160) return Response.json({error:'query_required_2_to_160_characters'},{status:400,headers});
  const last=SOURCE_CHECK_LAST.get(provider)||0;
  if(Date.now()-last<30000) return Response.json({error:'check_rate_limited',retry_after_seconds:30},{status:429,headers:{...headers,'Retry-After':'30'}});
  SOURCE_CHECK_LAST.set(provider,Date.now());
  const start=Date.now();
  const result=addon?await checkAddonSource(Number(addon[1]),query,env):
    await checkBuiltinSource(provider,query,env,new URL(request.url).origin);
  return Response.json({...result,patch_revision:PATCH_REVISION,checked_at:new Date().toISOString(),elapsed_ms:Date.now()-start,
    note:'One query/sample only; not proof of whole-catalog availability or client playback.'},{headers});
}
