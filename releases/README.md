# Release content

Each version has one editorial `release.json`. It contains the factual GitHub release notes, updater summary and structured RU/EN website copy. Version-specific screenshots and application binaries are not recreated by this mechanism.

For a new version, create its editorial record, move relevant previous facts into its history, update the application version and run `pnpm release:notes`. `pnpm build` checks the generated release notes against this source. `package-updater.mjs` takes its notes from the same record while preserving signing and signature verification.

The editorial record intentionally does not contain its own Git commit hash or a future CI run ID. Such a self-reference cannot be prepared before the build. `finalize-release.mjs` resolves the actual tag revision and full successful installer workflow after publication, and includes those facts in `website-release.json` together with the actual asset hashes and editorial revision.

The metadata workflow runs when an accepted stable release is published. All five existing payloads must already be uploaded. It accepts neither draft nor prerelease, verifies both installer scenarios and downloads/hashes each payload before adding the website sidecar. Existing binaries, release history, `latest.json` and signatures are not replaced. Rerunning with identical metadata is a no-op; changing an existing sidecar fails for inspection.

Every 15 minutes a lightweight stable-release check recovers missing metadata, including suppressed `GITHUB_TOKEN` release events and temporarily incomplete uploads. Existing metadata makes a scheduled run a no-op. Manual dispatch remains available for immediate publication or a full repeated verification. All recovery paths retain the same installer and checksum gates. GitHub may delay scheduled runs. This workflow does not approve or publish an untested application build.

```sh
pnpm release:notes
pnpm build
node scripts/finalize-release.mjs 1.2.2
node scripts/finalize-release.mjs 1.2.2 --publish
```

The website independently validates the metadata, source content, installer run identity, asset sizes, digests and updater information before using it. Its periodic check provides a retry path without a cross-repository write credential.
