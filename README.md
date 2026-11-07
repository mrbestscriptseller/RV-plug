# Metadata Lens

A read-only diagnostic plugin for Revenge on Android.

## Scope

Metadata Lens is intended to display only Discord channel and permission metadata already delivered to the currently logged-in Discord account. It does not bypass Discord permissions, request hidden data, scrape messages, or access authentication tokens.

## Target reported by the tester

- Revenge: 0980cfc-main
- Discord: 352.17 (352017)
- Revenge Manager: 1.3.2

## Development status

This repository is being prepared. No installable build is published yet. Compatibility with the exact reported Revenge runtime must be verified before release.

## Planned inspection

- Channel IDs, names, and channel types available to the account
- Parent/category relationships
- Permission metadata exposed to the client
- Clear indication when metadata is unavailable

## Security

The plugin will be open source and read-only. Do not install unofficial client plugins unless you have reviewed and trust their source.
