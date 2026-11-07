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
  function readCachedChannel(store, id) {
    if (!store) return null;
    for (const method of ["getChannel","getChannelById","getCachedChannel"]) {
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
      targetId:String(item.id || item.target_id || item.targetId || "unknown"),
      targetType:Number(item.type) === 1 ? "User" : Number(item.type) === 0 ? "Role" : "Unknown",
      allow:String(item.allow == null ? "" : item.allow),
      deny:String(item.deny == null ? "" : item.deny)
    }));
  }
  function scan() {
    const gs = getStore("GuildStore"), cs = getStore("ChannelStore"), gcs = getStore("GuildChannelStore");
    if (!gs || typeof gs.getGuilds !== "function") throw new Error("GuildStore unavailable.");
    if (!cs || typeof cs.getMutableGuildChannelsForGuild !== "function") throw new Error("ChannelStore unavailable.");
    const guilds = gs.getGuilds() || {}, results = [];
    let total = 0, skipped = 0, enriched = 0, unresolved = 0;
    Object.keys(guilds).forEach(guildId => {
      const guild = guilds[guildId] || {};
      let raw;
      try { raw = cs.getMutableGuildChannelsForGuild(guildId) || {}; } catch (_) { skipped++; return; }
      const channels = (Array.isArray(raw) ? raw : Object.keys(raw).map(k => raw[k])).filter(ch => ch && ch.id);
      const categories = {};
      channels.forEach(ch => { if (Number(ch.type) === 4) categories[String(ch.id)] = ch.name || "Unnamed category"; });
      const items = channels.sort((a,b) => Number(a.position || 0) - Number(b.position || 0)).slice(0,500).map(original => {
        let ch = original, recoveredFrom = "";
        if (!ch.name || /^hidden channel$/i.test(String(ch.name))) {
          const recovered = readCachedChannel(cs,ch.id) || readCachedChannel(gcs,ch.id);
          if (recovered && recovered.name && !/^hidden channel$/i.test(String(recovered.name))) {
            ch = Object.assign({},original,recovered); recoveredFrom = "local store"; enriched++;
          } else unresolved++;
        }
        const overwrites = normalizeOverwrites(ch);
        const id = String(ch.id);
        let createdAt = "";
        if (/^\d{17,20}$/.test(id)) {
          try { createdAt = new Date(Math.floor(Number(id) / 4194304) + 1420070400000).toISOString(); } catch (_) {}
        }
        return {
          name:String(ch.name || "Hidden Channel"), id, type:channelType(ch.type), rawType:Number(ch.type),
          category:ch.parent_id ? (categories[String(ch.parent_id)] || "Category metadata unavailable") : "No category",
          categoryId:ch.parent_id ? String(ch.parent_id) : "", position:Number(ch.position || 0),
          topic:String(ch.topic || ""), nsfw:!!ch.nsfw, createdAt,
          overwriteCount:overwrites.length, explicitRoleOverrides:overwrites.filter(x => x.targetType === "Role").length,
          explicitUserOverrides:overwrites.filter(x => x.targetType === "User").length, overwrites, recoveredFrom
        };
      });
      total += items.length;
      if (items.length) results.push({name:String(guild.name || "Server"),id:String(guildId),channels:items});
    });
    return {guilds:results,total,skipped,enriched,unresolved,scannedAt:new Date().toLocaleString()};
  }
  function label(value, style, key) {
    return React.createElement(RN.Text,{key,style:Object.assign({color:"#F2F3F5",fontSize:13,marginBottom:5},style || {})},String(value));
  }
  function button(title,onPress,primary,key) {
    return React.createElement(RN.Pressable,{key,onPress,android_ripple:{color:"#ffffff22"},style:{backgroundColor:primary?"#5865F2":"#303338",paddingVertical:12,paddingHorizontal:14,borderRadius:10,marginBottom:9,alignItems:"center"}},label(title,{fontWeight:"700",marginBottom:0},"txt"));
  }
  function Settings() {
    const [report,setReport] = React.useState(null);
    const [error,setError] = React.useState("");
    const [probe,setProbe] = React.useState(null);
    const [query,setQuery] = React.useState("");
    const [expanded,setExpanded] = React.useState({});
    const [showProbe,setShowProbe] = React.useState(false);

    function runScan() {
      try { setReport(scan()); setError(""); setExpanded({}); }
      catch(e) { setReport(null); setError(String(e && e.message || e)); }
    }
    function probeSidebar() {
      const found = [], modules = vendetta.metro && vendetta.metro.modules;
      if (!modules || typeof modules !== "object") return ["Metro module registry unavailable."];
      const exact = /channel.?list|list.?channel|guild.?channel|channel.?category|category.?channel|channel.?item|channel.?row|sidebar.?channel|guild.?sidebar/i;
      Object.keys(modules).forEach(id => {
        const mod = modules[id]; if (!mod) return;
        const path = String(mod.__filePath || mod.path || mod.verboseName || "");
        const ex = mod.publicModule && mod.publicModule.exports;
        if (!ex || (typeof ex !== "object" && typeof ex !== "function")) return;
        const names = Object.keys(ex).filter(k => {
          const v = ex[k], n = v && (v.displayName || v.name || v.type && (v.type.displayName || v.type.name));
          return exact.test(k + " " + String(n || ""));
        });
        if (exact.test(path) || names.length) found.push("Module "+id+" | "+(path || "no source path")+" | "+(names.slice(0,6).join(", ") || Object.keys(ex).slice(0,8).join(", ")));
      });
      ["ChannelStore","GuildStore","GuildChannelStore"].forEach(n => {
        const s = getStore(n); found.push("Store "+n+": "+(s ? Object.keys(s).slice(0,16).join(", ") : "not found"));
      });
      return found.length ? found.slice(0,30) : ["No matching sidebar component exports found. This build's native sidebar patch point is not confirmed."];
    }

    const nodes = [
      React.createElement(RN.View,{key:"hero",style:{backgroundColor:"#202226",borderRadius:14,padding:16,marginBottom:14}},
        label("METADATA LENS",{color:"#AEB4FF",fontSize:11,fontWeight:"800",letterSpacing:1.2},"eyebrow"),
        label("Local channel inspector",{fontSize:22,fontWeight:"800",marginBottom:7},"hero-title"),
        label("Read-only inspection of metadata already held by Discord on this device. No permission bypass, message access, network requests, or server navigation.",{color:"#B9BBC1",lineHeight:19,marginBottom:0},"hero-copy")
      ),
      button("Scan cached metadata",runScan,true,"scan"),
      button(showProbe ? "Hide compatibility report" : "Check sidebar compatibility",() => {
        if (!probe) { try { setProbe(probeSidebar()); } catch(e) { setProbe(["Check failed: "+String(e && e.message || e)]); } }
        setShowProbe(!showProbe);
      },false,"probe")
    ];
    if (error) nodes.push(React.createElement(RN.View,{key:"error",style:{padding:12,backgroundColor:"#442B2B",borderRadius:9,marginBottom:12}},label("Scan failed: "+error,{color:"#FFB4AB",marginBottom:0},"err")));
    if (showProbe && probe) {
      nodes.push(React.createElement(RN.View,{key:"probe-box",style:{padding:12,backgroundColor:"#202226",borderRadius:10,marginBottom:12}},
        label("Compatibility report",{fontWeight:"800",marginBottom:8},"probe-head"),
        ...probe.map((p,i)=>label(p,{fontSize:11,color:"#B9BBC1"}, "probe-"+i))
      ));
    }
    if (report) {
      nodes.push(React.createElement(RN.View,{key:"stats",style:{padding:13,backgroundColor:"#202226",borderRadius:10,marginBottom:12}},
        label("SCAN SUMMARY",{fontSize:10,color:"#AEB4FF",fontWeight:"800",letterSpacing:1},"stats-title"),
        label(report.guilds.length+" servers  ·  "+report.total+" cached channels",{fontSize:16,fontWeight:"800"},"stats-main"),
        label(report.enriched+" names recovered  ·  "+report.unresolved+" still hidden  ·  "+report.skipped+" skipped",{fontSize:11,color:"#B9BBC1"},"stats-sub"),
        label("Scanned: "+report.scannedAt,{fontSize:10,color:"#92979F",marginBottom:0},"stats-time")
      ));
      nodes.push(React.createElement(RN.TextInput,{key:"search",value:query,onChangeText:setQuery,placeholder:"Search channel, category, or ID",placeholderTextColor:"#858990",autoCorrect:false,style:{backgroundColor:"#202226",color:"#F2F3F5",paddingHorizontal:13,paddingVertical:11,borderRadius:10,marginBottom:12,fontSize:14}}));
      report.guilds.forEach(guild => {
        const matched = guild.channels.filter(ch => (ch.name+" "+ch.id+" "+ch.category+" "+ch.type).toLowerCase().includes(query.trim().toLowerCase()));
        if (!matched.length) return;
        nodes.push(label(guild.name+"  ·  "+matched.length+" channels",{fontSize:16,fontWeight:"800",marginTop:8,marginBottom:8},"guild-"+guild.id));
        matched.forEach(ch => {
          const isOpen = !!expanded[ch.id];
          nodes.push(React.createElement(RN.Pressable,{key:"row-"+ch.id,onPress:() => setExpanded(old => Object.assign({},old,{[ch.id]:!old[ch.id]})),android_ripple:{color:"#ffffff18"},style:{backgroundColor:"#202226",borderRadius:10,padding:12,marginBottom:7,borderWidth:1,borderColor:isOpen?"#5865F2":"#303338"}},
            React.createElement(RN.View,{style:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}},
              React.createElement(RN.View,{style:{flex:1,paddingRight:8}},
                label((ch.name === "Hidden Channel" ? "◈  " : "▤  ")+ch.name,{fontWeight:"700",fontSize:14,marginBottom:3},"name-"+ch.id),
                label(ch.type+"  ·  "+ch.category,{fontSize:11,color:"#B9BBC1",marginBottom:0},"sub-"+ch.id)
              ),
              label(isOpen?"−":"＋",{fontSize:18,color:"#AEB4FF",marginBottom:0},"toggle-"+ch.id)
            ),
            isOpen ? React.createElement(RN.View,{style:{marginTop:10,paddingTop:9,borderTopWidth:1,borderTopColor:"#3A3D44"}},
              label("Channel ID: "+ch.id,{fontSize:11,color:"#C9CDD3"},"id-"+ch.id),
              label("Category ID: "+(ch.categoryId || "none")+"  ·  Position: "+ch.position,{fontSize:11,color:"#C9CDD3"},"cat-"+ch.id),
              label("Permission overwrites: "+ch.overwriteCount+" (roles "+ch.explicitRoleOverrides+", user targets "+ch.explicitUserOverrides+")",{fontSize:11,color:"#C9CDD3"},"ow-count-"+ch.id),
              ch.topic ? label("Topic: "+ch.topic,{fontSize:11,color:"#C9CDD3"},"topic-"+ch.id) : null,
              ch.createdAt ? label("Created: "+ch.createdAt,{fontSize:11,color:"#92979F"},"created-"+ch.id) : null,
              ch.overwrites.slice(0,25).map((ow,i)=>label(ow.targetType+" target · "+ow.targetId+"\nAllow: "+(ow.allow || "—")+"  Deny: "+(ow.deny || "—"),{fontSize:10,color:"#92979F",marginTop:3},"ow-"+ch.id+"-"+i)),
              ch.recoveredFrom ? label("Name recovered from local store",{fontSize:10,color:"#57C58A"},"recovered-"+ch.id) : null,
              label("Permission targets are IDs, not a verified list of members who can access this channel.",{fontSize:10,color:"#F0B232",marginTop:4},"caution-"+ch.id)
            ) : null
          ));
        });
      });
      if (!nodes.some(n => n && n.key && String(n.key).startsWith("guild-"))) nodes.push(label("No channels match this search.",{color:"#B9BBC1"},"no-match"));
    } else {
      nodes.push(label("Run a scan to view cached servers and channels.",{color:"#B9BBC1",marginTop:6},"empty"));
    }
    return React.createElement(RN.ScrollView,{contentContainerStyle:{padding:14,paddingBottom:32},keyboardShouldPersistTaps:"handled"},nodes);
  }
  return {
    settings:Settings,
    onLoad:function(){vendetta.logger.log("Metadata Lens loaded · safe inline inspector");},
    onUnload:function(){}
  };
})()