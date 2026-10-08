import type { NextConfig } from 'next';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const config: NextConfig = { output:'export', distDir:process.env.NATURE_LENS_DIST_DIR || '.next', basePath, trailingSlash:true, images:{unoptimized:true}, env:{NEXT_PUBLIC_BASE_PATH:basePath} };
export default config;
