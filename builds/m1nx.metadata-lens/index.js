var plugin = (function () {
  var storage = bunny.plugin.createStorage();

  function getStore(name) {
    try {
      return bunny.metro.findByStoreName(name);
    } catch (_) {
      return null;
    }
  }

  function canViewChannel(permissionStore, channel) {
    if (!permissionStore || typeof permissionStore.can !== "function") return null;
    try {
      return permissionStore.can(1024n, channel) === true;
    } catch (_) {
      try {
        return permissionStore.can(1024, channel) === true;
      } catch (_) {
        return null;
      }
    }
  }

  function channelType(type) {
    var types = {
      0: "Text", 2: "Voice", 4: "Category", 5: "Announcement",
      10: "Announcement thread", 11: "Public thread", 12: "Private thread",
      13: "Stage", 15: "Forum", 16: "Media"
    };
    return types[type] || "Type " + String(type);
  }

  function scanMetadata() {
    var guildStore = getStore("GuildStore");
    var channelStore = getStore("ChannelStore");
    var permissionStore = getStore("PermissionStore");

    if (!guildStore || typeof guildStore.getGuilds !== "function") {
      return { ok: false, message: "GuildStore is unavailable in this Revenge build." };
    }
    if (!channelStore || typeof channelStore.getMutableGuildChannelsForGuild !== "function") {
      return { ok: false, message: "ChannelStore is unavailable in this Revenge build." };
    }
    if (!permissionStore || typeof permissionStore.can !== "function") {
      return { ok: false, message: "PermissionStore is unavailable. No channel data was displayed because visibility could not be verified." };
    }

    var guilds = guildStore.getGuilds() || {};
    var results = [];
    var total = 0;
    var omitted = 0;

    Object.keys(guilds).forEach(function (guildId) {
      var guild = guilds[guildId] || {};
      var channelMap;
      try {
        channelMap = channelStore.getMutableGuildChannelsForGuild(guildId) || {};
      } catch (_) {
        return;
      }

      var channels = Object.values(channelMap).filter(function (channel) {
        return channel && channel.id && String(channel.guild_id) === String(guildId);
      });
      var categories = {};
      channels.forEach(function (channel) {
        if (channel.type === 4) categories[channel.id] = channel.name || "Unnamed category";
      });

      var visible = channels.filter(function (channel) {
        return canViewChannel(permissionStore, channel) === true;
      }).sort(function (a, b) {
        return (a.position || 0) - (b.position || 0);
      });

      if (visible.length) {
        var entries = visible.map(function (channel) {
          var overwrites = channel.permissionOverwrites || channel.permission_overwrites || [];
          if (!Array.isArray(overwrites)) overwrites = Object.values(overwrites || {});
          return {
            id: String(channel.id),
            name: String(channel.name || "Unnamed channel"),
            type: channelType(channel.type),
            parentId: channel.parent_id ? String(channel.parent_id) : null,
            parentName: channel.parent_id ? (categories[channel.parent_id] || "Category metadata unavailable") : "No category",
            permissionOverwriteCount: overwrites.length
          };
        });

        var remaining = Math.max(0, 250 - total);
        total += entries.length;
        if (entries.length > remaining) {
          omitted += entries.length - remaining;
          entries = entries.slice(0, remaining);
        }
        if (entries.length) results.push({ id: String(guildId), name: String(guild.name || "Unnamed server"), channels: entries });
      }
    });

    return {
      ok: true,
      scannedAt: new Date().toISOString(),
      guildCount: results.length,
      channelCount: Math.min(total, 250),
      omittedCount: omitted,
      guilds: results
    };
  }

  function text(React, RN, value, style) {
    return React.createElement(RN.Text, {
      style: style || { color: "#FFFFFF", fontSize: 13, marginBottom: 6 }
    }, value);
  }

  return definePlugin({
    start: function () {
      storage.status = "Ready. Open Metadata Lens settings and tap Scan.";
    },
    stop: function () {},
    SettingsComponent: function () {
      var React = bunny.metro.common.React;
      var RN = bunny.metro.common.ReactNative;
      var Components = bunny.metro.common.components;
      bunny.api.storage.useObservable([storage]);

      var report = storage.report || null;
      var children = [
        text(React, RN, "Metadata Lens", { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginBottom: 8 }),
        text(React, RN, "Read-only inspection of channel metadata already present in your account. It does not request hidden channels or bypass permissions.", { color: "#B9BBC1", fontSize: 13, marginBottom: 12 }),
        React.createElement(RN.Pressable, {
          key: "scan",
          onPress: function () {
            try {
              storage.report = scanMetadata();
            } catch (error) {
              storage.report = { ok: false, message: "Scan failed: " + String(error && error.message || error) };
            }
          },
          style: { backgroundColor: "#5865F2", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 14 }
        }, text(React, RN, "Scan accessible channel metadata", { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 0 }))
      ];

      if (!report) {
        children.push(text(React, RN, storage.status || "No scan has been run yet.", { color: "#B9BBC1", fontSize: 13 }));
      } else if (!report.ok) {
        children.push(text(React, RN, report.message, { color: "#F0B232", fontSize: 13 }));
      } else {
        children.push(text(React, RN, "Servers: " + report.guildCount + "  |  Accessible channels: " + report.channelCount, { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 4 }));
        children.push(text(React, RN, "Scan time: " + report.scannedAt, { color: "#B9BBC1", fontSize: 11, marginBottom: 10 }));
        report.guilds.forEach(function (guild) {
          var rows = [
            React.createElement(Components.TableRow, {
              key: "guild-" + guild.id,
              label: guild.name,
              subLabel: "Server ID: " + guild.id,
              disabled: true
            })
          ];
          guild.channels.forEach(function (channel) {
            rows.push(React.createElement(Components.TableRow, {
              key: channel.id,
              label: channel.name + "  ·  " + channel.type,
              subLabel: "ID: " + channel.id + "\nCategory: " + channel.parentName + (channel.parentId ? " (" + channel.parentId + ")" : "") + "\nPermission overwrites: " + channel.permissionOverwriteCount,
              disabled: true
            }));
          });
          children.push(React.createElement(Components.TableRowGroup, { key: "group-" + guild.id, title: guild.name }, rows));
        });
        if (report.omittedCount > 0) {
          children.push(text(React, RN, "Display limit reached. " + report.omittedCount + " additional accessible channels were not shown.", { color: "#B9BBC1", fontSize: 12 }));
        }
      }

      return React.createElement(RN.ScrollView, { contentContainerStyle: { padding: 16 } }, children);
    }
  });
})();
