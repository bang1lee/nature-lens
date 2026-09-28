import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',use:{baseURL:'http://127.0.0.1:3107',headless:true},webServer:{command:'npx next dev --hostname 127.0.0.1 --port 3107',url:'http://127.0.0.1:3107',reuseExistingServer:true},reporter:'list'});
