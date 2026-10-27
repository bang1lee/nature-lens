import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 testDir:'.',testMatch:'cloud-auth.spec.ts',workers:1,
 use:{baseURL:'http://127.0.0.1:3112',headless:true},
 webServer:{
  cwd:fileURLToPath(new URL('..',import.meta.url)),
  command:'NATURE_LENS_DIST_DIR=.next-app-test NEXT_PUBLIC_IDENTIFY_URL=http://127.0.0.1:8787 NEXT_PUBLIC_SUPABASE_URL=https://mock.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_abcdefghijklmnop npx next dev --hostname 127.0.0.1 --port 3112',
  url:'http://127.0.0.1:3112',reuseExistingServer:false,
 },reporter:'list',
});
