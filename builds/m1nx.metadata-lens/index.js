var plugin=function(n,o,d,p,r,c,h,b){"use strict";
var storage=h.createStorage();
var React=p.common.React;
var RN=p.common.ReactNative;
function store(name){try{return p.findByStoreName(name)}catch(e){return null}}
function canView(permissionStore,channel){
  try{return permissionStore.can(1024n,channel)===true}catch(e){
    try{return permissionStore.can(1024,channel)===true}catch(e2){return false}
  }
}
function typeName(type){
  var names={0:"Text",2:"Voice",4:"Category",5:"Announcement",10:"Announcement thread",11:"Public thread",12:"Private thread",13:"Stage",15:"Forum",16:"Media"};
  return names[type]||("Type "+String(type));
}
function scan(){
  var gs=store("GuildStore"),cs=store("ChannelStore"),ps=store("PermissionStore");
  if(!gs||typeof gs.getGuilds!=="function")throw new Error("GuildStore is unavailable in this build.");
  if(!cs||typeof cs.getMutableGuildChannelsForGuild!=="function")throw new Error("ChannelStore is unavailable in this build.");
  if(!ps||typeof ps.can!=="function")throw new Error("PermissionStore is unavailable. Scan stopped safely.");
  var guilds=gs.getGuilds()||{},out=[],count=0;
  Object.keys(guilds).forEach(function(gid){
    var guild=guilds[gid]||{},map;
    try{map=cs.getMutableGuildChannelsForGuild(gid)||{}}catch(e){return}
    var channels=Array.isArray(map)?map:Object.keys(map).map(function(k){return map[k]});
    channels=channels.filter(function(ch){return ch&&ch.id&&String(ch.guild_id)===String(gid)});
    var cats={};
    channels.forEach(function(ch){if(ch.type===4)cats[ch.id]=ch.name||"Unnamed category"});
    var visible=channels.filter(function(ch){return canView(ps,ch)}).sort(function(a,b){return (a.position||0)-(b.position||0)});
    if(!visible.length)return;
    var items=visible.slice(0,200).map(function(ch){
      var ow=ch.permissionOverwrites||ch.permission_overwrites||[];
      if(!Array.isArray(ow))ow=Object.keys(ow).map(function(k){return ow[k]});
      return {name:String(ch.name||"Unnamed channel"),id:String(ch.id),type:typeName(ch.type),parent:ch.parent_id?(cats[ch.parent_id]||"Category metadata unavailable"):"No category",parentId:ch.parent_id?String(ch.parent_id):"",overwrites:ow.length};
    });
    count+=items.length;
    out.push({name:String(guild.name||"Server"),id:String(gid),channels:items});
  });
  return {guilds:out,count:count,time:new Date().toLocaleString()};
}
function txt(value,style,key){return React.createElement(RN.Text,{key:key,style:style||{color:"#FFFFFF",fontSize:13,marginBottom:6}},String(value))}
return definePlugin({
 start:function(){storage.report=null;},
 stop:function(){},
 SettingsComponent:function(){
  b.useObservable([storage]);
  var children=[
   txt("Metadata Lens",{color:"#FFFFFF",fontSize:20,fontWeight:"700",marginBottom:8},"title"),
   txt("Read-only view of channel metadata already available to your account. It does not reveal hidden channels or bypass permissions.",{color:"#B9BBC1",fontSize:13,marginBottom:12},"info"),
   React.createElement(RN.Pressable,{key:"scan",onPress:function(){try{storage.report=scan();storage.error=null}catch(e){storage.report=null;storage.error=String(e&&e.message||e)}},style:{backgroundColor:"#5865F2",padding:12,borderRadius:8,marginBottom:12}},txt("Scan accessible channels",{color:"#FFFFFF",fontSize:14,fontWeight:"700",textAlign:"center",marginBottom:0},"scanlabel"))
  ];
  if(storage.error)children.push(txt("Scan stopped: "+storage.error,{color:"#F0B232"},"error"));
  var report=storage.report;
  if(report){
   children.push(txt("Servers: "+report.guilds.length+" | Accessible channels: "+report.count+" | "+report.time,{color:"#FFFFFF",fontWeight:"700",marginBottom:10},"summary"));
   report.guilds.forEach(function(guild){
    children.push(txt(guild.name+"  •  Server ID: "+guild.id,{color:"#FFFFFF",fontSize:15,fontWeight:"700",marginTop:10,marginBottom:6},"g"+guild.id));
    guild.channels.forEach(function(ch){
     children.push(txt("# "+ch.name+"  ("+ch.type+")",{color:"#DCDDDE",fontSize:13,marginBottom:2},"c"+ch.id));
     children.push(txt("ID: "+ch.id+" | Category: "+ch.parent+(ch.parentId?" ["+ch.parentId+"]":"")+" | Overwrites: "+ch.overwrites,{color:"#AEB2B8",fontSize:11,marginBottom:7},"d"+ch.id));
    });
   });
  }else if(!storage.error){children.push(txt("No scan has been run yet.",{color:"#B9BBC1"},"empty"))}
  return React.createElement(RN.ScrollView,{contentContainerStyle:{padding:16}},children);
 }
});
}(bunny._jsx,bunny.api.assets,bunny.api.patcher,bunny.metro,bunny.metro.common.components,bunny.utils,bunny.plugin,bunny.api.storage);
