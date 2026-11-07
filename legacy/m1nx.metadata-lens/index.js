(function () {
  "use strict";
  const React = vendetta.metro.common.React;
  const RN = vendetta.metro.common.ReactNative;

  function getStore(name) {
    try { return vendetta.metro.findByStoreName(name); } catch (_) { return null; }
  }

  function channelType(type) {
    const names = {0:"Text",2:"Voice",4:"Category",5:"Announcement",10:"Announcement thread",11:"Public thread",12:"Private thread",13:"Stage",15:"Forum",16:"Media"};
    return names[type] || ("Type " + String(type));
  }

  // Read-only inspection of local Discord stores only. No network, message access,
  // permission changes, navigation, or token access.
  function readCachedChannel(store, id) {
    if (!store) return null;
    const methods = ["getChannel","getChannelById","getCachedChannel"];
    for (const method of methods) {
      try {
        if (typeof store[method] === "function") {
          const value = store[method](id);
          if (value && String(value.id || value.channelId || "") === String(id)) return value;
        }
      } catch (_) {}
    }
    return null;
  }

  function normalizeOverwrites(channel) {
    let list = channel.permissionOverwrites || channel.permission_overwrites || [];
    if (!Array.isArray(list)) list = Object.keys(list).map(key => list[key]);
    return list.filter(Boolean).map(item => ({
      targetId: String(item.id || item.target_id || item.targetId || "unknown"),
      targetType: Number(item.type) === 1 ? "user" : Number(item.type) === 0 ? "role" : "unknown",
      allow: String(item.allow == null ? "" : item.allow),
      deny: String(item.deny == null ? "" : item.deny)
    }));
  }

  function scan() {
    const guildStore = getStore("GuildStore");
    const channelStore = getStore("ChannelStore");
    const guildChannelStore = getStore("GuildChannelStore");
    if (!guildStore || typeof guildStore.getGuilds !== "function") throw new Error("GuildStore is unavailable. No data was collected.");
    if (!channelStore || typeof channelStore.getMutableGuildChannelsForGuild !== "function") throw new Error("ChannelStore is unavailable. No data was collected.");

    const guilds = guildStore.getGuilds() || {};
    const results = [];
    let total = 0, skipped = 0, enriched = 0, unresolved = 0;
    Object.keys(guilds).forEach(guildId => {
      const guild = guilds[guildId] || {};
      let raw;
      try { raw = channelStore.getMutableGuildChannelsForGuild(guildId) || {}; } catch (_) { skipped++; return; }
      const channels = Array.isArray(raw) ? raw : Object.keys(raw).map(key => raw[key]);
      const valid = channels.filter(ch => ch && ch.id);
      const categories = {};
      valid.forEach(ch => { if (Number(ch.type) === 4) categories[String(ch.id)] = ch.name || "Unnamed category"; });
      const items = valid.sort((a,b) => Number(a.position || 0) - Number(b.position || 0)).slice(0,500).map(original => {
        let ch = original;
        let recoveredFrom = "";
        if (!ch.name || /^hidden channel$/i.test(String(ch.name))) {
          const recovered = readCachedChannel(channelStore, ch.id) || readCachedChannel(guildChannelStore, ch.id);
          if (recovered && recovered.name && !/^hidden channel$/i.test(String(recovered.name))) {
            ch = Object.assign({}, original, recovered);
            recoveredFrom = "another local store reference";
            enriched++;
          } else unresolved++;
        }
        const overwrites = normalizeOverwrites(ch);
        return {
          name: String(ch.name || "Hidden Channel"), id: String(ch.id), type: channelType(ch.type),
          rawType: Number(ch.type), category: ch.parent_id ? (categories[String(ch.parent_id)] || "Category metadata unavailable") : "No category",
          categoryId: ch.parent_id ? String(ch.parent_id) : "", position: Number(ch.position || 0),
          topic: String(ch.topic || ""), nsfw: !!ch.nsfw, lastMessageId: String(ch.last_message_id || ""),
          createdAt: ch.id && /^\\d{17,20}$/.test(String(ch.id)) ? new Date(Number((BigInt(ch.id) >> 22n) + 1420070400000n)).toISOString() : "",
          overwriteCount: overwrites.length,
          explicitRoleOverrides: overwrites.filter(x => x.targetType === "role").length,
          explicitUserOverrides: overwrites.filter(x => x.targetType === "user").length,
          overwrites, recoveredFrom
        };
      });
      total += items.length;
      if (items.length) results.push({name:String(guild.name || "Server"), id:String(guildId), channels:items});
    });
    return {guilds:results,total,skipped,enriched,unresolved,scannedAt:new Date().toLocaleString()};
  }

  function text(value, style, key) {
    return React.createElement(RN.Text, {key, style:Object.assign({color:"#FFFFFF",fontSize:13,marginBottom:6},style || {})}, String(value));
  }

  function probeSidebar() {
    const found = [];
    const modules = vendetta.metro && vendetta.metro.modules;
    if (!modules || typeof modules !== "object") return ["Metro module registry is unavailable."];

    const exact = /channel.?list|list.?channel|guild.?channel|channel.?category|category.?channel|channel.?item|channel.?row|sidebar.?channel|guild.?sidebar/i;
    const ids = Object.keys(modules);
    ids.forEach(id => {
      const mod = modules[id];
      if (!mod) return;
      const filePath = String(mod.__filePath || mod.path || mod.verboseName || "");
      const exports = mod.publicModule && mod.publicModule.exports;
      if (!exports || (typeof exports !== "object" && typeof exports !== "function")) return;
      const labels = [];
      Object.keys(exports).forEach(key => {
        const value = exports[key];
        const displayName = value && (value.displayName || value.name || value.type && (value.type.displayName || value.type.name));
        const descriptor = key + (displayName ? " => " + String(displayName) : "");
        if (exact.test(descriptor)) labels.push(descriptor);
      });
      const def = exports.default;
      if (def) {
        const displayName = def.displayName || def.name || def.type && (def.type.displayName || def.type.name);
        const descriptor = "default" + (displayName ? " => " + String(displayName) : "");
        if (exact.test(descriptor)) labels.push(descriptor);
      }
      if (exact.test(filePath) || labels.length) {
        found.push("Module " + id + " | " + (filePath || "(no source path)") + " | " + (labels.slice(0,8).join(", ") || "matching source path; exports: " + Object.keys(exports).slice(0,10).join(", ")));
      }
    });

    const stores = ["ChannelStore","GuildStore","GuildChannelStore"];
    stores.forEach(name => {
      try {
        const store = getStore(name);
        found.push("Store " + name + ": " + (store ? Object.keys(store).slice(0,18).join(", ") : "not found"));
      } catch (_) {}
    });
    return found.length ? found.slice(0,45) : ["No exact channel-list/category component names found. Open the target server so its sidebar is visible, then run this check again."];
  }

  function Settings() {
    const [report,setReport] = React.useState(null);
    const [error,setError] = React.useState(null);
    const [probe,setProbe] = React.useState(null);
    const [overlay,setOverlay] = React.useState(false);
    const children = [
      text("Metadata Lens",{fontSize:20,fontWeight:"700",marginBottom:8},"title"),
      text("Read-only scan of channel metadata already cached by Discord on this device. It may include channels you cannot open if their metadata was delivered to the client. It cannot discover metadata Discord has not sent, read messages, or bypass server permissions.",{color:"#B9BBC1",marginBottom:14},"description"),
      React.createElement(RN.Pressable,{
        key:"probe",
        onPress:() => { try { setProbe(probeSidebar()); } catch(e) { setProbe(["Probe failed: "+String(e && e.message || e)]); } },
        style:{backgroundColor:"#3B3D44",padding:12,borderRadius:8,marginBottom:12}
      },text("Check native sidebar compatibility",{fontWeight:"700",textAlign:"center",marginBottom:0},"probe-label")),
      React.createElement(RN.Pressable,{
        key:"scan",
        onPress:() => { try { setReport(scan()); setError(null); } catch(e) { setReport(null); setError(String(e && e.message || e)); } },
        style:{backgroundColor:"#5865F2",padding:12,borderRadius:8,marginBottom:12}
      },text("Scan cached channel metadata",{fontWeight:"700",textAlign:"center",marginBottom:0},"scan-label"))
    ];
    if (probe) {
      children.push(text("Sidebar compatibility results",{fontWeight:"700",marginTop:12,marginBottom:8},"probe-title"));
      probe.forEach((line,index) => children.push(text(line,{color:"#B9BBC1",fontSize:11,marginBottom:5},"probe-"+index)));
    }
    if (error) children.push(text("Scan stopped: "+error,{color:"#F0B232"},"error"));
    if (!report && !error) children.push(text("Tap Scan cached channel metadata to begin.",{color:"#B9BBC1"},"empty"));
    if (report) {
      children.push(React.createElement(RN.Pressable,{key:"open-overlay",onPress:() => setOverlay(true),style:{backgroundColor:"#3B3D44",padding:12,borderRadius:8,marginBottom:12}},text("Open local channel overlay",{fontWeight:"700",textAlign:"center",marginBottom:0},"open-overlay-label")));
      children.push(text("Servers: "+report.guilds.length+"  |  Cached channels: "+report.total+"  |  Names recovered: "+report.enriched+"  |  Still hidden: "+report.unresolved,{fontWeight:"700",marginBottom:10},"summary"));
      if (!report.total) children.push(text("No channel metadata was found in the client cache. Discord may not have delivered hidden-channel metadata to this account.",{color:"#F0B232"},"none"));
      report.guilds.forEach(guild => {
        children.push(text(guild.name+"  |  Server ID: "+guild.id,{fontSize:15,fontWeight:"700",marginTop:12,marginBottom:7},"guild-"+guild.id));
        guild.channels.forEach(ch => {
          children.push(text("# "+ch.name+"  ("+ch.type+")",{color:"#DCDDDE",marginBottom:2},"channel-"+ch.id));
          children.push(text("ID: "+ch.id+"  |  Category: "+ch.category+(ch.categoryId?" ["+ch.categoryId+"]":"")+"  |  Permission overwrites: "+ch.overwriteCount,{color:"#AEB2B8",fontSize:11,marginBottom:8},"details-"+ch.id));
        });
      });
      if (report.skipped) children.push(text("Guilds skipped because their channel cache could not be read: "+report.skipped,{color:"#B9BBC1"},"skipped"));
    }
    const overlayChildren = [];
    if (report) {
      overlayChildren.push(text("Cached channel overview",{fontSize:19,fontWeight:"700",marginBottom:6},"overlay-title"));
      overlayChildren.push(text("Expanded local cache inspection. Locked entries are labels, not links. No messages or private member roster are read. Permission targets are IDs, not a verified list of people with access.",{color:"#B9BBC1",fontSize:12,marginBottom:14},"overlay-note"));
      report.guilds.forEach(guild => {
        overlayChildren.push(text(guild.name,{fontSize:16,fontWeight:"700",marginTop:10,marginBottom:8},"overlay-guild-"+guild.id));
        let lastCategory = null;
        guild.channels.filter(ch => ch.type !== "Category").forEach(ch => {
          if (ch.category !== lastCategory) {
            lastCategory = ch.category;
            overlayChildren.push(text("▾ "+lastCategory,{color:"#B9BBC1",fontWeight:"700",marginTop:8,marginBottom:5},"overlay-cat-"+guild.id+"-"+ch.category));
          }
          overlayChildren.push(React.createElement(RN.View,{key:"overlay-channel-"+ch.id,style:{paddingVertical:7,paddingHorizontal:9,marginBottom:4,backgroundColor:"#292B2F",borderRadius:7}},
            text("🔒  "+ch.name,{fontWeight:"600",marginBottom:3},"overlay-name-"+ch.id),
            text(ch.type+"  ·  Position "+ch.position,{color:"#B9BBC1",fontSize:11,marginBottom:2},"overlay-type-"+ch.id),
            text("Permission overrides: "+ch.overwriteCount+" (roles: "+ch.explicitRoleOverrides+", user-targets: "+ch.explicitUserOverrides+")",{color:"#AEB2B8",fontSize:10,marginBottom:2},"overlay-meta-"+ch.id),
            ch.topic ? text("Topic: "+ch.topic,{color:"#AEB2B8",fontSize:10,marginBottom:2},"overlay-topic-"+ch.id) : null,
            text("ID: "+ch.id+"  ·  Category ID: "+(ch.categoryId || "none"),{color:"#AEB2B8",fontSize:10,marginBottom:2},"overlay-ids-"+ch.id),
            ch.overwrites.slice(0,20).map((ow,i) => text(ow.targetType+" target "+ow.targetId+"  |  allow "+(ow.allow || "—")+"  |  deny "+(ow.deny || "—"),{color:"#92979F",fontSize:9,marginBottom:1},"overlay-ow-"+ch.id+"-"+i)),
            ch.recoveredFrom ? text("Name recovered from "+ch.recoveredFrom,{color:"#57C58A",fontSize:9,marginBottom:0},"overlay-recovered-"+ch.id) : null
          ));
        });
      });
    } else {
      overlayChildren.push(text("Run the cached metadata scan first.",{color:"#B9BBC1"},"overlay-empty"));
    }
    const modal = React.createElement(RN.Modal,{visible:overlay,transparent:true,animationType:"slide",onRequestClose:() => setOverlay(false)},
      React.createElement(RN.View,{style:{flex:1,backgroundColor:"rgba(0,0,0,0.88)",paddingTop:34,paddingHorizontal:12,paddingBottom:16}},
        React.createElement(RN.View,{style:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
          text("Metadata Lens · Overlay",{fontWeight:"700",fontSize:16,marginBottom:0},"overlay-heading"),
          React.createElement(RN.Pressable,{onPress:() => setOverlay(false),style:{padding:9,backgroundColor:"#3B3D44",borderRadius:7}},text("Close",{fontWeight:"700",marginBottom:0},"overlay-close"))
        ),
        React.createElement(RN.ScrollView,{contentContainerStyle:{paddingBottom:28}},overlayChildren)
      )
    );
    return React.createElement(React.Fragment,null,
      React.createElement(RN.ScrollView,{contentContainerStyle:{padding:16}},children),
      modal
    );
  }

  return {
    settings: Settings,
    onLoad: function () { vendetta.logger.log("Metadata Lens loaded"); },
    onUnload: function () {}
  };
})()