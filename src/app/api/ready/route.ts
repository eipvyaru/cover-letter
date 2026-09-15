import {getDb} from '@/db';
import {loadSystemPrompt} from '@/server/prompts/system-prompt';
export const runtime='nodejs';
export async function GET(){try{getDb().prepare('SELECT 1').get();await loadSystemPrompt(process.env);return Response.json({status:'ready'});}catch{return Response.json({status:'not_ready'},{status:503});}}
