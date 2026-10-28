import { defineConfig } from '@playwright/test';
// This suite covers the offline/unconfigured baseline. Never inherit owner service settings.
// Authenticated and gateway scenarios belong to the dedicated mock configurations.
export default defineConfig({testDir:'tests/e2e',use:{baseURL:'http://127.0.0.1:3107',headless:true},webServer:{command:'npx next dev --hostname 127.0.0.1 --port 3107',env:{NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'',NEXT_PUBLIC_IDENTIFY_URL:''},url:'http://127.0.0.1:3107',reuseExistingServer:false},reporter:'list'});
