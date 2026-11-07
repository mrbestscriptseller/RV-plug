# Metadata Lens

Read-only Revenge Classic plugin for inspecting channel metadata already available to the logged-in account.

## Target build
- Revenge: `0980cfc-main`
- Discord: `352.17 (352017)`
- Revenge Manager: `1.3.2`

## Install
In Revenge's plugin source prompt, enter this repository index:
`https://raw.githubusercontent.com/mrbestscriptseller/RV-plug/main/repo.json`

Then install **Metadata Lens**, enable it, open its settings, and tap **Scan accessible channels**.

## Scope and limitations
The plugin only displays channels for which the client's PermissionStore confirms VIEW_CHANNEL. It does not request hidden channel data, bypass permissions, read messages, make Discord API requests, or access authentication tokens. Store/API compatibility still needs on-device testing on the target build.
