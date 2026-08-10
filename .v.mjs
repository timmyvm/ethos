import { chromium } from "playwright-core";
const OUT = "/tmp/claude-0/-home-user-ethos/7e421fec-a198-5074-8500-b9e9ce3da134/scratchpad";
const now = Date.now(), day = 86400000;
const mk = (i, lesson, stars, idx) => ({
  id:`rep-${i}`, lesson_id:lesson, created_at:new Date(now-i*day).toISOString(),
  duration_s:72, transcript:"So um it works.", wpm:143, filler_count:4, fillers:[],
  pauses:[{t:5,len:0.4,kind:"beat"},{t:20,len:1.4,kind:"pre"},{t:44,len:1.0,kind:"mid"}],
  stars, focus:null, strength:null, supply:null, ethos_index:idx, audio_path:null,
  dimensions:null, mode:"daily", mods:[], xp_multiplier:1, boss_topic_id:null, accuracy:null,
});
const REPS=[mk(4,"f1",3,601),mk(3,"f1",3,618),mk(2,"f2",2,640),mk(1,"f2",2,689)];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport:{width:414,height:900}, deviceScaleFactor:2 });
await ctx.addInitScript(()=>{localStorage.setItem("sb-dthjdyitvieyufufkkly-auth-token",JSON.stringify({
  access_token:"fake",refresh_token:"fake",expires_at:Math.floor(Date.now()/1000)+3600,token_type:"bearer",
  user:{id:"00000000-0000-0000-0000-000000000001",is_anonymous:true,aud:"authenticated"}}));});
await ctx.route("**/rest/v1/**",(r)=>{const u=r.request().url();
  const j=(x)=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(x)});
  if(u.includes("/reps"))return j(REPS);
  if(u.includes("/xp_events"))return j(REPS.map(()=>({amount:10,created_at:new Date().toISOString()})));
  if(u.includes("/profiles"))return j({display_name:null,premium:false,premium_until:null});
  if(u.includes("/streak_freezes"))return j([]);
  if(u.includes("/streaks"))return j({freezes_equipped:0});
  return j([]);});
const p = await ctx.newPage();
await p.goto("http://localhost:3100/",{waitUntil:"networkidle"});
await p.waitForTimeout(1600);
await p.screenshot({ path:`${OUT}/polish-home.png`, clip:{x:0,y:0,width:414,height:760} });
await p.screenshot({ path:`${OUT}/polish-home-full.png`, fullPage:true });
console.log("ok");
await b.close();
