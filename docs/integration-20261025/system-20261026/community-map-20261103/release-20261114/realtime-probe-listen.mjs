// Read-only listener for the fixed synthetic UUID. Logs no other payloads or keys.
import {createRequire} from 'node:module';
process.loadEnvFile('.env.local');
const require=createRequire(process.cwd()+'/package.json');
const {createClient}=require('@supabase/supabase-js');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key){console.error('Missing public configuration');process.exit(1);}
const probe='fd1f30a0-5fd2-43b8-a666-bf2111100002';
const clients=[0,1].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
const channels=[];
let done=false;
async function shutdown(code){if(done)return;done=true;await Promise.all(channels.map((channel,i)=>Promise.race([clients[i].removeChannel(channel),new Promise(r=>setTimeout(r,3000))])));clients.forEach(c=>c.realtime.disconnect());process.exit(code);}
process.on('SIGINT',()=>void shutdown(0));
const stop=setTimeout(()=>{console.log('LISTENER_TIMEOUT');void shutdown(0);},300000);
try{
 await Promise.all(clients.map((client,i)=>new Promise((resolve,reject)=>{
  const channel=client.channel(`map-probe-${Date.now()}-${i}`);channels[i]=channel;
  const timer=setTimeout(()=>reject(new Error(`listener ${i+1} subscription timeout`)),15000);
  channel.on('postgres_changes',{event:'*',schema:'public',table:'community_map_points'},async event=>{
   if((event.new?.id??event.old?.id)!==probe)return;
   const received=new Date().toISOString();
   const {data,error}=await client.from('community_map_points').select('id').eq('id',probe).limit(1);
   console.log(JSON.stringify({listener:i+1,event:event.eventType,received,refetch:error?'error':(data?.length?'present':'absent')}));
  }).subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);console.log(`LISTENER_${i+1}_SUBSCRIBED`);resolve();}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){clearTimeout(timer);reject(new Error(`listener ${i+1} ${status}`));}});
 })));
 console.log('BOTH_READY');
}catch(e){clearTimeout(stop);console.error(e.message);await shutdown(1);}
