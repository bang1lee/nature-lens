// Read-only, fixed synthetic ID: does not print user records, URLs, or keys.
process.loadEnvFile('.env.local');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw Error('missing public configuration');
const id='fd1f30a0-5fd2-43b8-a666-bf2111100002';
const check=async table=>{const r=await fetch(`${url}/rest/v1/${table}?select=id&id=eq.${id}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(12000)});const data=await r.json();return {status:r.status,count:Array.isArray(data)?data.length:null};};
const [points,feed]=await Promise.all([check('community_map_points'),check('community_feed')]);
console.log(JSON.stringify({synthetic_points:points,synthetic_feed:feed}));
process.exit(points.status===200&&points.count===0&&feed.status===200&&feed.count===0?0:1);
