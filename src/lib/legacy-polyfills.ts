/**
 * Inline polyfills for Safari / iOS 15.0–15.3 (e.g. iPhone 7), injected in the
 * document head before the app's modules. Only built-ins that the shipped
 * bundle calls and that those Safari versions lack. Each is defined only when
 * missing, so current browsers are untouched.
 */
export const LEGACY_POLYFILL_SCRIPT = `(function(){function d(o,k,f){if(!(k in o))try{Object.defineProperty(o,k,{value:f,writable:true,configurable:true})}catch(e){}}d(Object,"hasOwn",function(o,k){if(o==null)throw new TypeError("Cannot convert undefined or null to object");return Object.prototype.hasOwnProperty.call(Object(o),k)});function at(i){var n=this.length>>>0;i=Math.trunc(i)||0;if(i<0)i+=n;return i<0||i>=n?undefined:this[i]}d(Array.prototype,"at",at);d(String.prototype,"at",function(i){return at.call(String(this),i)});d(Array.prototype,"findLast",function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return this[i]});d(Array.prototype,"findLastIndex",function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return i;return -1})})();`;
