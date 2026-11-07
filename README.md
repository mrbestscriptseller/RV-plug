# Metadata Lens

A read-only diagnostic plugin for Revenge Classic on Android.

## Target reported by the tester

- Revenge bundle: `0980cfc-main` (release commit from the Revenge Classic bundle)
- Discord: `352.17 (352017)`
- Revenge Manager: `1.3.2`

## What it inspects

- Channel names, IDs, and types present in the logged-in account's local channel store
- Parent/category relationships
- Permission-overwrite counts for those channels
- A visibility check using the client's `PermissionStore`

The plugin does not make Discord API requests, retrieve hidden-channel data, bypass permissions, read messages, or access authentication tokens. It displays only channels for which the client permission store confirms `VIEW_CHANNEL`.

## Install repository

Add this repository URL in Revenge's Plugins source/repository prompt:

`https://raw.githubusercontent.com/mrbestscriptseller/RV-plug/main/`

Then install **Metadata Lens**, enable it, open its settings, and tap **Scan accessible channel metadata**.

## Development status

The Revenge Classic repository index, manifest, and JavaScript plugin source have been uploaded. JavaScript syntax was checked. Device/runtime testing on the reported build is still pending; the plugin will report an unavailable store or permission check rather than displaying unverified channel data.

## Security

This is open source and read-only. Review the code before installing any third-party Discord client plugin.
