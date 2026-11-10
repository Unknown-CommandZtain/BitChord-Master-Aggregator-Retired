# Security and privacy notes

Before publishing any code-derived repository, check every file, Git commit, tag, release asset, issue, CI artifact, branch, README and `.env` for sensitive data. **Publishing a new sanitized ZIP does not clean an older repository's Git history.** Revoke leaked credentials before history cleanup; consult GitHub's guide on removing sensitive data.

The source archive excludes historical upstream URLs and secrets by design. Do not add:

- bearer/API keys, access tokens, personal provider manifests, session paths or signed URLs;
- IP addresses, Cloudflare account identifiers, personal Worker domain names, logs with track/query/session details;
- original private deployment ZIPs, local `.dev.vars`, `.env`, or `wrangler` state files.

Private providers may require app-bound proof. Do not spoof clients, proxy user attestation, or bypass authentication. Request an approved server-to-server API if integration is desired.

Delete project-specific R2 buckets, API tokens, Durable Object storage and deployed Workers separately, avoiding infrastructure shared with unrelated projects.
