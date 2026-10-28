const { chromium } = await import('file:///C:/Users/BaOBaODz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const assert=await import('node:assert/strict');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1540,height:870},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4176/artifacts/nxt-serial-scope-preview.html');await page.getByText('Serial: B65006700 · Tính riêng nhập / xuất / tồn').waitFor();
 await page.getByLabel('Tìm sổ NXT').fill('B65006700');await page.waitForTimeout(600);
 const table=page.getByRole('table',{name:'Sổ chi tiết NXT'});assert.equal(await table.locator('tbody tr').count(),4);assert.equal(await page.getByRole('button',{name:/Mở Serial/}).count(),0);assert.equal(await table.locator('tbody tr').nth(1).locator('td').nth(6).innerText(),'1\n3.703.704 đ');assert.equal(await table.locator('tbody tr').nth(2).locator('td').nth(7).innerText(),'1\n3.703.704 đ');assert.equal(await table.locator('tbody tr').nth(3).locator('td').nth(8).innerText(),'0\n0 đ');assert.equal((await page.locator('body').innerText()).includes('Thẻ kho'),false);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:'artifacts/nxt-serial-scope-desktop-dark.png',fullPage:true});
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất Excel',exact:true}).click();await(await downloadPromise).saveAs('artifacts/nxt-serial-scope.xlsx');
 await page.evaluate(()=>{const append=Element.prototype.append;Element.prototype.append=function(...nodes){append.apply(this,nodes);for(const n of nodes)if(n instanceof HTMLIFrameElement&&n.contentWindow)n.contentWindow.print=()=>{document.body.dataset.printChecked='1'}}});
 await page.getByRole('button',{name:'In sổ',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.printChecked==='1');const frame=page.frames().find(f=>f!==page.mainFrame());assert.ok(frame);assert.ok((await frame.locator('body').innerText()).includes('Serial: B65006700'));assert.equal((await frame.locator('body').innerText()).includes('50 Serial'),false);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/nxt-serial-scope-mobile.png',fullPage:true});assert.equal(errors.length,0,errors.join('\n'));
 console.log('Serial UI passed: 1 in / 1 out / 0 closing, single Serial, renamed navigation, Excel, print iframe, dark and mobile without overflow.');
} finally {await browser.close()}
