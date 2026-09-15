import {spawn} from 'node:child_process';
try{process.loadEnvFile('.env');}catch{}
const port=process.env.PORT||'8792';const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',port],{stdio:'inherit',env:{...process.env,NODE_ENV:'production'}});child.on('exit',code=>process.exit(code??1));
