# GitHub publication and archiving checklist

- [ ] Decide whether the repository is **public** and choose a license if reuse/forking is intended; audit third-party code ownership first.
- [ ] Audit all existing repo branches, tags, release ZIPs, issues and Git history for private URLs/secrets. A clean latest snapshot does not clean old commits.
- [ ] Revoke exposed keys before history cleanup. See GitHub's sensitive-data-removal guidance.
- [ ] Upload the **public ZIP contents only**, not the private p11 JavaScript, private ZIP, real `wrangler.jsonc`, `.env`, or console logs.
- [ ] Confirm repo README begins with a retirement notice and the final version is **v3.7.17-p11**.
- [ ] Optionally add final tag/release and mark it as historical (only after checking release assets).
- [ ] Close or resolve any open issues and pull requests.
- [ ] Archive via repository Settings > Danger Zone > Archive this repository.
- [ ] Independently retire the Cloudflare Worker, R2 buckets and API credentials; GitHub archive does not do that.
