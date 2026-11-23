# Release content

Each version has one editorial `release.json`. It contains the factual GitHub release notes, updater summary and structured RU/EN website copy. Version-specific screenshots and application binaries are not recreated by this mechanism.

The same command generates `runtime/releases/catalog.ts` for the in-app history.
It registers all canonical releases through the current application version;
build checks fail if the catalog is stale. The app retains prose and bullet
changes in both languages, resolves version placeholders, and incorporates
reviewed older history from these records. Its installed version comes from
Tauri, while the available update version comes from the updater.
`archive.json` preserves the early Woods 1.0.0–1.1.1 notes that predate the
editorial release records. They are no longer embedded in the settings source.

For a new version, create its editorial record, move relevant previous facts into its history, update the application version and run `pnpm release:notes`. `pnpm build` checks the generated release notes against this source. `package-updater.mjs` takes its notes from the same record while preserving signing and signature verification.

The editorial record intentionally does not contain its own Git commit hash or a future CI run ID. Such a self-reference cannot be prepared before the build. `finalize-release.mjs` resolves the actual tag revision and full successful installer workflow after publication, and includes those facts in `website-release.json` together with the actual asset hashes and editorial revision.

The metadata workflow runs when an accepted stable release is published. All five existing payloads must already be uploaded. It accepts neither draft nor prerelease, verifies both installer scenarios and downloads/hashes each payload before adding the website sidecar. Existing binaries, release history, `latest.json` and signatures are not replaced. Rerunning with identical metadata is a no-op; changing an existing sidecar fails for inspection.

An existing sidecar pins its accepted full CI run, so later diagnostics or full rebuilds do not change its identity. For new metadata, diagnostic artifact-reuse runs cannot shadow a qualifying full installer run. The complete sidecar must fit within 256 KiB before upload; oversized editorial content fails without publishing unusable metadata.

Every 15 minutes a lightweight stable-release check recovers missing metadata, including suppressed `GITHUB_TOKEN` release events and temporarily incomplete uploads. Existing metadata makes a scheduled run a no-op. Manual dispatch remains available for immediate publication or a full repeated verification. All recovery paths retain the same installer and checksum gates. GitHub may delay scheduled runs. This workflow does not approve or publish an untested application build.

```sh
pnpm release:notes
pnpm build
node scripts/finalize-release.mjs 1.2.2
node scripts/finalize-release.mjs 1.2.2 --publish
```

The website independently validates the metadata, source content, installer run identity, asset sizes, digests and updater information before using it. Its periodic check provides a retry path without a cross-repository write credential.
