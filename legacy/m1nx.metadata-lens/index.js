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

  // Read only channel objects already cached in the official client stores.
  // No network requests, permission changes, message reads, or token access.
  function scan() {
    const guildStore = getStore("GuildStore");
    const channelStore = getStore("ChannelStore");
    if (!guildStore || typeof guildStore.getGuilds !== "function") throw new Error("GuildStore is unavailable. No data was collected.");
    if (!channelStore || typeof channelStore.getMutableGuildChannelsForGuild !== "function") throw new Error("ChannelStore is unavailable. No data was collected.");

    const guilds = guildStore.getGuilds() || {};
    const results = [];
    let total = 0;
    let skipped = 0;
    Object.keys(guilds).forEach(guildId => {
      const guild = guilds[guildId] || {};
      let raw;
      try { raw = channelStore.getMutableGuildChannelsForGuild(guildId) || {}; } catch (_) { skipped++; return; }
      const channels = Array.isArray(raw) ? raw : Object.keys(raw).map(key => raw[key]);
      const valid = channels.filter(ch => ch && ch.id);
      const categories = {};
      valid.forEach(ch => { if (ch.type === 4) categories[ch.id] = ch.name || "Unnamed category"; });
      const items = valid.sort((a,b) => (a.position || 0) - (b.position || 0)).slice(0,500).map(ch => {
        let overwrites = ch.permissionOverwrites || ch.permission_overwrites || [];
        if (!Array.isArray(overwrites)) overwrites = Object.keys(overwrites).map(key => overwrites[key]);
        return {
          name: String(ch.name || "Unnamed channel"), id: String(ch.id), type: channelType(ch.type),
          category: ch.parent_id ? (categories[ch.parent_id] || "Category metadata unavailable") : "No category",
          categoryId: ch.parent_id ? String(ch.parent_id) : "", overwriteCount: overwrites.length
        };
      });
      total += items.length;
      if (items.length) results.push({name:String(guild.name || "Server"), id:String(guildId), channels:items});
    });
    return {guilds:results,total,skipped,scannedAt:new Date().toLocaleString()};
  }

  function text(value, style, key) {
    return React.createElement(RN.Text, {key, style:Object.assign({color:"#FFFFFF",fontSize:13,marginBottom:6},style || {})}, String(value));
  }

  function probeSidebar() {
    const found = [];
    const modules = vendetta.metro && vendetta.metro.modules;
    if (!modules || typeof modules !== "object") return ["Metro module registry is unavailable."];

    const ids = Object.keys(modules);
    let inspected = 0;
    ids.forEach(id => {
      const mod = modules[id];
      if (!mod) return;
      const filePath = String(mod.__filePath || mod.path || mod.verboseName || "");
      const exports = mod.publicModule && mod.publicModule.exports;
      if (!exports || (typeof exports !== "object" && typeof exports !== "function")) return;
      const keys = Object.keys(exports);
      const defaultExport = exports.default;
      const labels = [];
      keys.forEach(key => {
        const value = exports[key];
        const displayName = value && (value.displayName || value.name || value.type && (value.type.displayName || value.type.name));
        if (/channel|guild|category|sidebar|thread/i.test(key) || /channel|guild|category|sidebar|thread/i.test(String(displayName || ""))) {
          labels.push(key + (displayName ? " => " + String(displayName) : ""));
        }
      });
      if (defaultExport) {
        const displayName = defaultExport.displayName || defaultExport.name || defaultExport.type && (defaultExport.type.displayName || defaultExport.type.name);
        if (/channel|guild|category|sidebar|thread/i.test(String(displayName || ""))) labels.push("default => " + String(displayName));
      }
      if (/channel|guild|category|sidebar|thread/i.test(filePath) || labels.length) {
        found.push("Module " + id + " | " + (filePath || "(no source path)") + " | " + (labels.slice(0,12).join(", ") || keys.slice(0,12).join(", ")));
        inspected++;
      }
    });
    const storeNames = ["ChannelStore","GuildStore","GuildChannelStore"];
    storeNames.forEach(name => {
      try {
        const store = getStore(name);
        found.push("Store " + name + ": " + (store ? Object.keys(store).slice(0,24).join(", ") : "not found"));
      } catch (_) {}
    });
    return found.length ? found.slice(0,80) : ["No loaded channel-related module exports found. Open a server and its channel list, then run this check again."];
  }

  function Settings() {
    const [report,setReport] = React.useState(null);
    const [error,setError] = React.useState(null);
    const [probe,setProbe] = React.useState(null);
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
      children.push(text("Servers: "+report.guilds.length+"  |  Cached channels: "+report.total+"  |  "+report.scannedAt,{fontWeight:"700",marginBottom:10},"summary"));
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
    return React.createElement(RN.ScrollView,{contentContainerStyle:{padding:16}},children);
  }

  return {
    settings: Settings,
    onLoad: function () { vendetta.logger.log("Metadata Lens loaded"); },
    onUnload: function () {}
  };
})()