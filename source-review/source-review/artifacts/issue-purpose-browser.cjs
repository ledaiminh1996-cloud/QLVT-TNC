const {chromium}=require('C:/Users/BaOBaODz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
await page.goto('http://127.0.0.1:4176/?preview=documents');await page.evaluate(()=>document.documentElement.dataset.theme='dark');
await page.getByRole('button',{name:'Phiếu xuất kho VT-TB',exact:true}).click();
await page.getByRole('button',{name:'Lập phiếu',exact:true}).click();
await page.getByRole('combobox',{name:'Họ tên lái xe *',exact:true}).focus();
await page.getByRole('option',{name:/TX001/}).click();
await page.getByRole('combobox',{name:'Biển số xe *',exact:true}).waitFor();
await page.waitForFunction(()=>document.querySelector('input[aria-label="Số Km (ODO) hiện tại *"]').value==='123456');
for(const name of ['Đơn giá','Thành tiền','Mục đích','Ghi chú','Thao tác'])await page.getByRole('dialog').getByRole('columnheader',{name,exact:true}).waitFor();
for(const name of ['Thiết bị nhận','ODO (km)','Giờ máy','VAT'])if(await page.getByRole('dialog').getByRole('columnheader',{name,exact:true}).count())throw Error('Unexpected column '+name);
const top=[];for(const name of ['Số phiếu','Ngày chứng từ *','Kho xuất *']){const box=await page.getByLabel(name,{exact:true}).boundingBox();top.push(box.y)}
if(Math.max(...top)-Math.min(...top)>3)throw Error('Header fields not aligned: '+top);
const receiver=await page.getByLabel('Người nhận',{exact:true}).boundingBox();if(receiver.y<=top[0])throw Error('Recipient must begin row two');
const group=await page.getByRole('group',{name:'Nhóm xe',exact:true}).boundingBox();const linked=await page.getByRole('group',{name:'Phương tiện/thiết bị ghép nối',exact:true}).boundingBox();if(Math.abs(group.y-linked.y)>3)throw Error('Linked fields not beside group');
const generator=await page.getByRole('textbox',{name:'Máy phát',exact:true}).boundingBox();const container=await page.getByRole('textbox',{name:'Container số',exact:true}).boundingBox();if(generator.x>=container.x)throw Error('Generator must precede container');
await page.getByRole('textbox',{name:'Nội dung',exact:true}).waitFor();
const purpose=page.getByRole('combobox',{name:'Mục đích dòng 1',exact:true});
if(!(await purpose.locator('option[value="liquidation"]').isDisabled()))throw Error('New stock allows liquidation');
await page.getByRole('combobox',{name:'Trạng thái hàng dòng 1',exact:true}).selectOption('recovered');
await purpose.selectOption('liquidation');
await page.getByRole('combobox',{name:'Trạng thái hàng dòng 1',exact:true}).selectOption('new');
if(await purpose.inputValue()!=='use')throw Error('New stock retains liquidation');
const headings=await page.getByRole('dialog').locator('th').allTextContents();if(headings.slice(4,9).join('|')!=='Đơn giá|Thành tiền|Serial|Vị trí lắp|Mục đích')throw Error('Wrong column order');
await page.getByRole('textbox',{name:'Máy phát',exact:true}).fill('MP-001');
if(await page.getByRole('textbox',{name:'Máy phát',exact:true}).inputValue()!=='MP-001')throw Error('Generator free text failed');
await page.screenshot({path:'artifacts/issue-dark-desktop.png' ,fullPage:false});
for(const width of [1024,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:'artifacts/issue-dark-'+width+'.png',fullPage:false});const box=await page.getByRole('dialog').boundingBox();if(box.x<0||box.x+box.width>width)throw Error('Dialog overflow '+width)}
await page.setViewportSize({width:1600,height:1000});
const palette=await page.evaluate(()=>{const css=selector=>getComputedStyle(document.querySelector(selector));return {panel:css('.issue-header').backgroundColor,input:css('.issue-header input:not([readonly]):not([type="checkbox"])').backgroundColor,readonly:css('.issue-header input[readonly]').backgroundColor,text:css('.issue-header label').color,checkbox:css('.issue-header input[type="checkbox"]:checked').backgroundColor}});
if(palette.panel!=='rgb(24, 36, 56)'||palette.checkbox!=='rgb(147, 197, 253)')throw Error('Unexpected dark palette '+JSON.stringify(palette));
console.log(palette);
await page.evaluate(()=>document.documentElement.dataset.theme='light');
await page.screenshot({path:'artifacts/issue-light-check.png',fullPage:false});
const light=await page.locator('.issue-header').evaluate(el=>getComputedStyle(el).backgroundColor);if(light==='rgb(24, 36, 56)')throw Error('Dark overrides leaked to light mode');
await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.emulateMedia({media:'print'});
const printed=await page.locator('.issue-header').evaluate(el=>getComputedStyle(el).backgroundColor);if(printed==='rgb(24, 36, 56)')throw Error('Dark screen styles leaked to print');
if(errors.length)throw Error(errors.join(';'));console.log('Verified Content label, generator before container, reordered columns, liquidation disabled for new stock, recovery to new resets purpose, dark/light/print and responsive layout.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
