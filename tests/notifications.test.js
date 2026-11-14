const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function worker() {
 const handlers={},shown=[],deleted=[];
 const sandbox={self:{location:{origin:'https://example.test'},registration:{showNotification:async(title,options)=>shown.push({title,options})},clients:{claim:async()=>{},matchAll:async()=>[],openWindow:async url=>url},addEventListener:(name,fn)=>handlers[name]=fn},caches:{keys:async()=>['mycal-v7','mycal-v8','other-app'],delete:async key=>deleted.push(key)},Date,URL};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),sandbox);
 return {handlers,shown,deleted};
}
test('Calendar receives push without requiring an open page',async()=>{
 const w=worker();let pending;
 w.handlers.push({data:{json:()=>({title:'Birthday',body:'Today',tag:'test'})},waitUntil:p=>pending=p});await pending;
 assert.equal(w.shown[0].title,'Birthday');assert.equal(w.shown[0].options.body,'Today');
});
test('Expired notifications are not displayed',()=>{
 const w=worker();w.handlers.push({data:{json:()=>({expires_at:'2000-01-01'})},waitUntil:()=>assert.fail('expired push displayed')});assert.equal(w.shown.length,0);
});
test('Calendar update preserves other applications caches',async()=>{
 const w=worker();let pending;w.handlers.activate({waitUntil:p=>pending=p});await pending;
 assert.deepEqual(w.deleted,['mycal-v7']);
});
