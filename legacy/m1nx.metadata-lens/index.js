(function () {
  "use strict";
  const React = vendetta.metro.common.React;
  const RN = vendetta.metro.common.ReactNative;

  function getStore(name) {
    try { return vendetta.metro.findByStoreName(name); } catch (_) { return null; }
  }

  function canView(permissionStore, channel) {
    try { return permissionStore.can(1024n, channel) === true; }
    catch (_) {
      try { return permissionStore.can(1024, channel) === true; }
      catch (_) { return false; }
    }
  }

  function channelType(type) {
    const names = {0:"Text",2:"Voice",4:"Category",5:"Announcement",10:"Announcement thread",11:"Public thread",12:"Private thread",13:"Stage",15:"Forum",16:"Media"};
    return names[type] || ("Type " + String(type));
  }

  function scan() {
    const guildStore = getStore("GuildStore");
    const channelStore = getStore("ChannelStore");
    const permissionStore = getStore("PermissionStore");
    if (!guildStore || typeof guildStore.getGuilds !== "function") throw new Error("GuildStore is unavailable. No data was collected.");
    if (!channelStore || typeof channelStore.getMutableGuildChannelsForGuild !== "function") throw new Error("ChannelStore is unavailable. No data was collected.");
    if (!permissionStore || typeof permissionStore.can !== "function") throw new Error("Permission checks are unavailable. Scan stopped safely.");

    const guilds = guildStore.getGuilds() || {};
    const results = [];
    let total = 0;
    Object.keys(guilds).forEach(guildId => {
      const guild = guilds[guildId] || {};
      let raw;
      try { raw = channelStore.getMutableGuildChannelsForGuild(guildId) || {}; } catch (_) { return; }
      const channels = Array.isArray(raw) ? raw : Object.keys(raw).map(key => raw[key]);
      const valid = channels.filter(ch => ch && ch.id && String(ch.guild_id) === String(guildId));
      const categories = {};
      valid.forEach(ch => { if (ch.type === 4) categories[ch.id] = ch.name || "Unnamed category"; });
      const visible = valid.filter(ch => canView(permissionStore, ch)).sort((a,b) => (a.position || 0) - (b.position || 0)).slice(0,250);
      if (!visible.length) return;
      const items = visible.map(ch => {
        let overwrites = ch.permissionOverwrites || ch.permission_overwrites || [];
        if (!Array.isArray(overwrites)) overwrites = Object.keys(overwrites).map(key => overwrites[key]);
        return {
          name: String(ch.name || "Unnamed channel"), id: String(ch.id), type: channelType(ch.type),
          category: ch.parent_id ? (categories[ch.parent_id] || "Category metadata unavailable") : "No category",
          categoryId: ch.parent_id ? String(ch.parent_id) : "", overwriteCount: overwrites.length
        };
      });
      total += items.length;
      results.push({name:String(guild.name || "Server"), id:String(guildId), channels:items});
    });
    return {guilds:results,total,scannedAt:new Date().toLocaleString()};
  }

  function text(value, style, key) {
    return React.createElement(RN.Text, {key, style:Object.assign({color:"#FFFFFF",fontSize:13,marginBottom:6},style || {})}, String(value));
  }

  function Settings() {
    const [report,setReport] = React.useState(null);
    const [error,setError] = React.useState(null);
    const children = [
      text("Metadata Lens",{fontSize:20,fontWeight:"700",marginBottom:8},"title"),
      text("Read-only channel metadata for channels visible to your current account. This tool does not reveal hidden channels or bypass permissions.",{color:"#B9BBC1",marginBottom:14},"description"),
      React.createElement(RN.Pressable,{
        key:"scan",
        onPress:() => { try { setReport(scan()); setError(null); } catch(e) { setReport(null); setError(String(e && e.message || e)); } },
        style:{backgroundColor:"#5865F2",padding:12,borderRadius:8,marginBottom:12}
      },text("Scan accessible channels",{fontWeight:"700",textAlign:"center",marginBottom:0},"scan-label"))
    ];
    if (error) children.push(text("Scan stopped: "+error,{color:"#F0B232"},"error"));
    if (!report && !error) children.push(text("Tap Scan accessible channels to begin.",{color:"#B9BBC1"},"empty"));
    if (report) {
      children.push(text("Servers: "+report.guilds.length+"  |  Accessible channels: "+report.total+"  |  "+report.scannedAt,{fontWeight:"700",marginBottom:10},"summary"));
      report.guilds.forEach(guild => {
        children.push(text(guild.name+"  |  Server ID: "+guild.id,{fontSize:15,fontWeight:"700",marginTop:12,marginBottom:7},"guild-"+guild.id));
        guild.channels.forEach(ch => {
          children.push(text("# "+ch.name+"  ("+ch.type+")",{color:"#DCDDDE",marginBottom:2},"channel-"+ch.id));
          children.push(text("ID: "+ch.id+"  |  Category: "+ch.category+(ch.categoryId?" ["+ch.categoryId+"]":"")+"  |  Permission overwrites: "+ch.overwriteCount,{color:"#AEB2B8",fontSize:11,marginBottom:8},"details-"+ch.id));
        });
      });
    }
    return React.createElement(RN.ScrollView,{contentContainerStyle:{padding:16}},children);
  }

  return {
    settings: Settings,
    onLoad: function () { vendetta.logger.log("Metadata Lens loaded"); },
    onUnload: function () {}
  };
})()