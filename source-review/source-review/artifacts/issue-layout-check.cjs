const {chromium}=require('C:/Users/BaOBaODz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
await page.goto('http://127.0.0.1:4176/?preview=documents');
await page.getByRole('button',{name:'Phiếu xuất kho VT-TB',exact:true}).click();
await page.getByRole('button',{name:'Lập phiếu',exact:true}).click();
await page.getByRole('combobox',{name:'Họ tên lái xe *',exact:true}).focus();
await page.getByRole('option',{name:/TX001/}).click();
await page.getByRole('combobox',{name:'Biển số xe *',exact:true}).waitFor();
await page.waitForFunction(()=>document.querySelector('input[aria-label="Số Km (ODO) hiện tại *"]').value==='123456');
for(const name of ['Đơn giá','Thành tiền','Ghi chú','Thao tác'])await page.getByRole('dialog').getByRole('columnheader',{name,exact:true}).waitFor();
for(const name of ['Thiết bị nhận','ODO (km)','Giờ máy','VAT'])if(await page.getByRole('dialog').getByRole('columnheader',{name,exact:true}).count())throw Error('Unexpected column '+name);
const top=[];for(const name of ['Số phiếu','Ngày chứng từ *','Kho xuất *']){const box=await page.getByLabel(name,{exact:true}).boundingBox();top.push(box.y)}
if(Math.max(...top)-Math.min(...top)>3)throw Error('Header fields not aligned: '+top);
const receiver=await page.getByLabel('Người nhận',{exact:true}).boundingBox();if(receiver.y<=top[0])throw Error('Recipient must begin row two');
const group=await page.getByRole('group',{name:'Nhóm xe',exact:true}).boundingBox();const linked=await page.getByRole('group',{name:'Phương tiện/thiết bị ghép nối',exact:true}).boundingBox();if(Math.abs(group.y-linked.y)>3)throw Error('Linked fields not beside group');
await page.getByRole('textbox',{name:'Máy phát',exact:true}).fill('MP-001');
if(await page.getByRole('textbox',{name:'Máy phát',exact:true}).inputValue()!=='MP-001')throw Error('Generator free text failed');
await page.screenshot({path:'artifacts/issue-layout-desktop.png' ,fullPage:false});
for(const width of [1024,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:'artifacts/issue-layout-'+width+'.png',fullPage:false});const box=await page.getByRole('dialog').boundingBox();if(box.x<0||box.x+box.width>width)throw Error('Dialog overflow '+width)}
if(errors.length)throw Error(errors.join(';'));console.log('Verified recipient on row two, linked trailer/container/generator beside vehicle group, generator free text, responsive dialog, no page errors.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
