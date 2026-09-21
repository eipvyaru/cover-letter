import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
vi.mock('server-only',()=>({}));
import {activateSystemPrompt,addSystemPrompt,listSystemPrompts,loadSystemPrompt} from '@/server/prompts/system-prompt';

const directories:string[]=[];
afterEach(async()=>{await Promise.all(directories.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
describe('system prompt versions',()=>{
 it('preserves the original and switches active prompt by file ID',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cover-letter-prompts-'));directories.push(directory);
  const path=join(directory,'system_prompt.md');const original='Original prompt '.repeat(12);const updated='New prompt '.repeat(12);
  await writeFile(path,original);const settings={SYSTEM_PROMPT_PATH:path};
  const initial=await listSystemPrompts(settings);expect(initial).toHaveLength(1);expect(initial[0].active).toBe(true);
  const modifiedAt=new Date('2026-09-21T20:47:26.000Z');
  const items=await addSystemPrompt(settings,updated,modifiedAt);
  expect(items).toHaveLength(2);expect(items.find(item=>item.modifiedAt===modifiedAt.toISOString())?.active).toBe(false);
  const next=items.find(item=>!item.active)!;
  await activateSystemPrompt(settings,next.id);
  expect((await loadSystemPrompt(settings)).content).toBe(updated.trim());
  expect((await readFile(path,'utf8'))).toBe(original);
  expect((await listSystemPrompts(settings)).find(item=>item.id===next.id)?.active).toBe(true);
  await expect(activateSystemPrompt(settings,'../../other.md')).rejects.toThrow();
  await activateSystemPrompt(settings,initial[0].id);
  expect((await loadSystemPrompt(settings)).content).toBe(original.trim());
 });
});
