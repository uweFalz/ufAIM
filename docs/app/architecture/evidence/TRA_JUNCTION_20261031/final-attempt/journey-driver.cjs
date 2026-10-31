const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const pw=require('/Users/uwefalz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [url,profile,out]=process.argv.slice(2);
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const port=(await fs.readFile(profile+'/DevToolsActivePort','utf8')).trim().split('\n')[0];
 const browser=await pw.chromium.connectOverCDP('http://127.0.0.1:'+port);
 const context=browser.contexts()[0];
 let page=await context.newPage(); page.setDefaultTimeout(12000);
 await page.setViewportSize({width:1500,height:1000});
 const result={url,events:[],console:[],sourceHashes:[],status:'running'};
 const record=async(name)=>{const text=await page.locator('body').innerText();result.events.push({name,time:new Date().toISOString(),text});await page.screenshot({path:out+'/'+String(result.events.length).padStart(2,'0')+'-'+name+'.png'});console.log(name);};
 const state=()=>page.evaluate(async()=>{const {getMessagingService}=await import('/src/shared/runtime/runtimeServices.js');return getMessagingService().sendCmdAwait('Spot.GetState',{});});
 function monitor(){page.on('console',m=>{if(['error','warning'].includes(m.type()))result.console.push({type:m.type(),text:m.text()});});page.on('pageerror',e=>result.console.push({type:'pageerror',text:e.message,stack:e.stack,time:new Date().toISOString()}));}
 try {
  monitor(); await page.goto(url); await page.getByText('Daten hineinziehen',{exact:true}).waitFor();await record('start');
  await page.evaluate(()=>{window.__gateStates=[];let last='';new MutationObserver(()=>{const e=document.querySelector('#gndImportWorkbenchOverlay')||document.querySelector('[data-tool-kind="gnd-import"]');const t=(e?.innerText||document.body.innerText).slice(-14000);if(t!==last&&/reading|processing|angenommen|completed|analysiert|Import result/.test(t)){window.__gateStates.push({time:performance.now(),text:t});last=t;}}).observe(document.body,{subtree:true,childList:true,characterData:true});});
  const choosing=page.waitForEvent('filechooser');await page.getByText('Daten hineinziehen',{exact:true}).click();await(await choosing).setFiles('/Users/uwefalz/Developer/ufAIM/test/samples/Landshut/5500R074-082.TRA');await record('import-accepted');
  await page.getByRole('button',{name:'Import prüfen',exact:true}).waitFor();await page.getByRole('button',{name:'Import prüfen',exact:true}).click();await page.getByRole('button',{name:'Übernehmen & anzeigen',exact:true}).waitFor();await record('candidate');
  result.lifecycle=await page.evaluate(()=>window.__gateStates);
  await page.getByRole('button',{name:'Übernehmen & anzeigen',exact:true}).click();await page.getByRole('button',{name:'Alignment-Element bearbeiten',exact:true}).first().waitFor();
  result.before=await state();assert.equal(Object.keys(result.before.objects).length,1);
  await page.locator('#btnCockpitClose').click();await page.getByRole('button',{name:'Fit',exact:true}).click();await page.waitForTimeout(500);await record('main-fit');
  await page.getByRole('button',{name:'Cockpit',exact:true}).click();await page.getByRole('button',{name:'Alignment-Element bearbeiten',exact:true}).first().click();result.initialRadius=await page.locator('#aeRadius').inputValue();
  await page.locator('#aeRadius').fill('-840');await page.locator('#aeApply').click();await page.waitForFunction(()=>{const t=document.querySelector('#aeStatus')?.textContent;return t&&t!=='Anwenden'&&t!=='Elementfokus gesetzt';},{},{timeout:30000});
  result.editStatus=await page.locator('#aeStatus').innerText();await record('edited');assert.equal(result.editStatus,'Alignment neu berechnet');
  result.after=await state();const object=Object.values(result.after.objects)[0];result.axtran=object.data.extended.horizontalRealizationReceipts.at(-1).receipt.diagnostics;assert.ok(result.axtran.evidence,'AXTRAN evidence must exist');assert.equal(result.axtran.evidence.admissible,false);assert.equal(object.data.kernel.sparse[0].curvature,-1/840);assert.equal(object.data.kernel.sparse.filter(e=>e.arcLength===0&&e.type==='fixed'&&e.curvature!==0).length,5);
  await page.locator('#btnAlignmentEditorClose').click();
  await page.locator('#inputCursorS').fill('800');await page.locator('#inputCursorS').press('Enter');
  await page.getByRole('button',{name:'q · Lok',exact:true}).first().click();await record('q-800');
  await page.getByRole('button',{name:'L · Bänder',exact:true}).first().click();await record('bands-800');
  const cdp=await context.newCDPSession(page);const scripts=[];cdp.on('Debugger.scriptParsed',e=>scripts.push(e));await cdp.send('Debugger.enable');
  for(const s of scripts.filter(s=>/buildSparseFromLandFAT|SparseAlignmentBuilder|materializeAlignmentDataFromSparse|AlignmentAxtranEvidenceService/.test(s.url))){const r=await cdp.send('Debugger.getScriptSource',{scriptId:s.scriptId});result.sourceHashes.push({url:s.url,sha256:crypto.createHash('sha256').update(r.scriptSource).digest('hex')});}await cdp.send('Debugger.disable');
  await page.close(); page=await context.newPage();page.setDefaultTimeout(12000);await page.setViewportSize({width:1500,height:1000});monitor();await page.goto(url);await page.getByText('Vorhandene Objekte',{exact:true}).waitFor();await page.getByText('Vorhandene Objekte',{exact:true}).click();await record('first-reopen-list');
  result.reopened=await state();assert.deepEqual(result.reopened.objects,result.after.objects);await page.getByRole('button',{name:'5500R074-082 auswaehlen',exact:true}).click();await page.getByRole('button',{name:'Cockpit',exact:true}).waitFor();await page.getByRole('button',{name:'Cockpit',exact:true}).click();await page.getByRole('button',{name:'Alignment-Element bearbeiten',exact:true}).first().click();assert.equal(await page.locator('#aeRadius').inputValue(),'-840');result.reopenedReceipt=await page.locator('#aeRealizationReceipt').innerText();assert.ok(result.reopenedReceipt.includes('Observed persisted realization changes'));await record('reopened-editor');assert.deepEqual((await state()).objects,result.after.objects);result.status='passed';
 } catch(e){result.status='failed';result.failure=e.stack;console.log(e.stack);process.exitCode=1;}
 await fs.writeFile(out+'/journey.json',JSON.stringify(result,null,2));console.log('RESULT '+result.status);
 // Keep only this explicitly created browser available for Root's visual review.
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
