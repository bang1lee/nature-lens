import {spawn} from 'node:child_process';
const mode=process.argv[2];if(!['dev','build'].includes(mode))throw new Error('Expected dev or build');
const host=process.env.TAURI_DEV_HOST||'127.0.0.1';
const args=['node_modules/next/dist/bin/next',mode,...(mode==='dev'?['--hostname',host,'--port','3108']:[])];
const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,NATURE_LENS_DIST_DIR:'.next-native',NEXT_PUBLIC_BASE_PATH:'',NEXT_PUBLIC_NATIVE_SHELL:'true'}});
child.on('exit',code=>process.exit(code??1));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
