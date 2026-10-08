// Read-only: never prints secrets, sends photos, or calls paid providers.
const env=process.env;
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const checks=[
 ['server-enabled',env.IDENTIFY_ENABLED==='true'],
 ['supabase-url',https(env.SUPABASE_URL)],
 ['supabase-key',Boolean(env.SUPABASE_PUBLISHABLE_KEY)],
 ['provider-key',Boolean(env.PLANTNET_API_KEY||env.KINDWISE_INSECT_API_KEY)],
 ['policy-url',https(env.IDENTIFY_POLICY_URL)],
 ['allowed-origins',Boolean(env.IDENTIFY_ALLOWED_ORIGINS)&&env.IDENTIFY_ALLOWED_ORIGINS.split(',').every(x=>{try{const u=new URL(x.trim());return https(u.href)&&u.origin===x.trim();}catch{return false;}})],
 ['web-gateway-url',https(env.NEXT_PUBLIC_IDENTIFY_URL)],
 ['web-auth-url',https(env.NEXT_PUBLIC_SUPABASE_URL)&&env.NEXT_PUBLIC_SUPABASE_URL===env.SUPABASE_URL],
 ['web-auth-key',Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)&&env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY===env.SUPABASE_PUBLISHABLE_KEY],
 ['persistent-ledger-path',Boolean(env.IDENTIFY_LEDGER_PATH)&&env.IDENTIFY_LEDGER_PATH.startsWith('/')],
];
console.log(JSON.stringify({ready:checks.every(([,ok])=>ok),checks:checks.map(([name,ok])=>({name,status:ok?'configured':'missing-or-invalid'})),note:'Configuration only; provider contracts, policy content, credentials, TLS and persistent storage still need live verification.'},null,2));
process.exitCode=checks.every(([,ok])=>ok)?0:1;
