// A small script injected into every page the AI builds, in the preview and on shared links.
// It makes the page behave like a real website inside the sandbox:
// - "#section" links scroll instead of loading the Lab inside the page
// - forms never navigate away; unhandled ones are saved automatically
// - localStorage works (in memory) instead of crashing the page's script
// - window.Lab.submit / results / onResults save and read real answers from everyone

export type RuntimeOpts = { project: string; api: string; source: "preview" | "live" };

const SCRIPT = String.raw`(function(){
var C=window.__LAB__||{};var API=C.api+"/api/responses/"+C.project;
function mem(){var d={};return{getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});
function toast(t){var el=document.createElement("div");el.textContent=t;el.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111;color:#fff;padding:12px 18px;border-radius:999px;font:600 14px/1.2 system-ui,sans-serif;z-index:2147483647;box-shadow:0 8px 30px rgba(0,0,0,.25)";document.body.appendChild(el);setTimeout(function(){el.remove()},2600)}
function submit(form,data){return fetch(API,{method:"POST",headers:{"content-type":"text/plain"},body:JSON.stringify({form:String(form||"form"),data:data||{},source:C.source})}).then(function(r){return r.json()}).catch(function(){return{ok:false}})}
function results(form){return fetch(API+"?summary=1&form="+encodeURIComponent(form||"")).then(function(r){return r.json()}).catch(function(){return{total:0,fields:{}}})}
function onResults(form,cb,ms){var stop=false;function tick(){if(stop)return;results(form).then(function(r){try{cb(r)}catch(e){console.error(e)}}).finally(function(){setTimeout(tick,ms||5000)})}tick();return function(){stop=true}}
window.Lab={submit:submit,results:results,onResults:onResults,toast:toast};
document.addEventListener("click",function(e){
  var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a||e.defaultPrevented)return;
  var h=a.getAttribute("href")||"";
  if(h.charAt(0)==="#"){e.preventDefault();if(h.length>1){var el=document.getElementById(decodeURIComponent(h.slice(1)));if(el)el.scrollIntoView({behavior:"smooth",block:"start"})}else window.scrollTo({top:0,behavior:"smooth"});return}
  if(/^(mailto:|tel:|javascript:)/i.test(h))return;
  var u;try{u=new URL(h,document.baseURI)}catch(_){return}
  if(u.origin===C.api&&!/^\/(p|i)\//.test(u.pathname)){e.preventDefault();toast("This link isn't set up yet");return}
  e.preventDefault();window.open(u.href,"_blank","noopener");
});
window.addEventListener("submit",function(e){
  var f=e.target;var handled=e.defaultPrevented;e.preventDefault();if(handled)return;
  var d={};new FormData(f).forEach(function(v,k){if(typeof v!=="string")return;d[k]=d[k]?d[k]+", "+v:v});
  submit(f.getAttribute("name")||f.id||"form",d).then(function(r){toast(r&&r.ok?"Thanks! Your answer was saved.":"Couldn't send. Check the wifi.");if(r&&r.ok)f.reset()});
});
})();`;

export function withRuntime(html: string, opts: RuntimeOpts) {
  const tag = `<script>window.__LAB__=${JSON.stringify(opts).replace(/</g, "\\u003c")};${SCRIPT}</script>`;
  // Insert after <head> (or <html>, or the doctype) so the page doesn't drop into quirks mode.
  const at = html.match(/<head[^>]*>/i) || html.match(/<html[^>]*>/i) || html.match(/<!doctype[^>]*>/i);
  if (at) return html.replace(at[0], at[0] + tag);
  return tag + html;
}

// Shared pages remember which project's answers they belong to.
const MARK = /^<!--lab-project:([a-z0-9]{4,20})-->\n?/;
export function markProject(html: string, project: string) {
  return `<!--lab-project:${project}-->\n${html.replace(MARK, "")}`;
}
export function readProject(html: string): { project: string | null; html: string } {
  const m = html.match(MARK);
  return m ? { project: m[1], html: html.slice(m[0].length) } : { project: null, html };
}
