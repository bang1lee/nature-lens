import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'tests',testMatch:'beta-photos.spec.ts',workers:1,
  use:{baseURL:'http://127.0.0.1:3142',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined}},
  webServer:{command:'NATURE_LENS_DIST_DIR=.next-beta-photos NEXT_PUBLIC_IDENTIFY_URL=http://127.0.0.1:8787 NEXT_PUBLIC_AUTH_OTP_ENABLED=true NEXT_PUBLIC_TAXON_INFO=off NEXT_PUBLIC_SUPABASE_URL=https://mock.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_abcdefghijklmnop npx next dev --hostname 127.0.0.1 --port 3142',url:'http://127.0.0.1:3142',reuseExistingServer:false,timeout:120000},
  reporter:'list',outputDir:'test-results/beta-photos',
});
