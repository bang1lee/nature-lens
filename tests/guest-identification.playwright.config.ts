import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'.',testMatch:'guest-identification.spec.ts',workers:1,
  use:{baseURL:'http://127.0.0.1:3150',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}},
  webServer:{
    cwd:new URL('..',import.meta.url).pathname,
    command:'NATURE_LENS_DIST_DIR=.next-guest-test NEXT_PUBLIC_IDENTIFY_URL=http://127.0.0.1:8787 NEXT_PUBLIC_SUPABASE_URL=https://mock.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_abcdefghijklmnop npx next dev --hostname 127.0.0.1 --port 3150',
    url:'http://127.0.0.1:3150',reuseExistingServer:false,
  },
  reporter:'list',
});
