/* Saves an inspection, PDI or service sheet on The Motoring Central's system, against the booking it belongs to.
   Used by inspection.html, pdi.html and service-sheet.html. The partner is already logged in on the main site
   (same browser), so the saved log-in is reused here. If they are not logged in, or offline, the record stays on
   this device only and the page says so. */
(function(){
var SB_URL='https://hctboldpuyztugpwexdy.supabase.co',SB_KEY='sb_publishable_RbxYYgru3tOZZuwC5w6OcA_4alE1zBf';
var client=null;
function load(){if(client)return client;client=new Promise(function(res,rej){
 function make(){try{res(window.supabase.createClient(SB_URL,SB_KEY))}catch(e){rej(e)}}
 if(window.supabase&&window.supabase.createClient)return make();
 var s=document.createElement('script');s.src='vendor/supabase.js';s.onload=make;s.onerror=function(){rej(new Error('offline'))};document.head.appendChild(s)});
 client.catch(function(){client=null});return client}
function clean(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
/* o: {kind:'inspection'|'pdi'|'service', job, booking_id, reg, summary:{}, blob (PDF, optional)} -> {ok, why} */
function save(o){return load().then(function(sb){return sb.auth.getSession().then(function(r){var s=r&&r.data&&r.data.session;if(!s)return{ok:false,why:'login'};
  var uid=s.user.id,path=null,up=Promise.resolve();
  if(o.blob){path=uid+'/'+o.kind+'-'+(clean(o.reg)||'vehicle')+'-'+Date.now()+'.pdf';
   up=sb.storage.from('job-records').upload(path,o.blob,{contentType:'application/pdf'}).then(function(x){if(x.error){path=null;throw x.error}})}
  return up.then(function(){return sb.from('job_records').insert({kind:o.kind,job_ref:String(o.job||'').slice(0,40)||null,booking_id:o.booking_id||null,reg:clean(o.reg).slice(0,10)||null,summary:o.summary||{},pdf_path:path})})
   .then(function(x){if(x.error)throw x.error;return{ok:true}})})}).catch(function(e){var m=String(e&&(e.message||e.code)||'');
  return{ok:false,why:/row-level|permission|policy|42501/i.test(m)?'not_allowed':/fetch|network|offline/i.test(m)?'offline':'error'}})}
var MSG={login:'Saved on this device only. Log in on the main site to keep it on your account and share it with the customer.',
 not_allowed:'Saved on this device only. Your partner account must be approved to save records to bookings.',
 offline:'Saved on this device only. We could not reach our system, so check your connection and save again.',
 error:'Saved on this device only. Something went wrong sending it to your account. Try saving again.'};
window.TMCrec={save:save,msg:function(r){return r&&r.ok?'Saved to the booking. The customer can see it in their account.':MSG[(r&&r.why)||'error']}};
})();
