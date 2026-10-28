const {chromium}=require('C:/Users/BaOBaODz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext({viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
await page.goto('http://127.0.0.1:4176/?preview=documents');await page.getByRole('button',{name:'Lập phiếu',exact:true}).click();await page.getByRole('button',{name:'Nhập nhanh dòng',exact:true}).click();
const dialog=page.getByRole('dialog',{name:'Nhập nhanh dòng vật tư',exact:true});
await dialog.getByRole('button',{name:'Sao chép bảng kèm tiêu đề'}).click();let copied=await page.evaluate(()=>navigator.clipboard.readText());if(!copied.startsWith('Mã vật tư\tSố lượng\tĐơn giá'))throw Error('Missing copied headers');
const tsv='Ghi chú\tĐơn giá\tMã vật tư\tSố lượng\nHàng, kiểm tra\t150.000,5\tM-IN-TDONG-0001\t2';
await dialog.getByLabel('Mã vật tư nhập nhanh dòng 1').evaluate((el,text)=>{const data=new DataTransfer();data.setData('text/plain',text);el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},tsv);
if(await dialog.getByLabel('Đơn giá nhập nhanh dòng 1').inputValue()!=='150.000,5')throw Error('Reordered price mapped incorrectly');
if(await dialog.getByLabel('Ghi chú nhập nhanh dòng 1').inputValue()!=='Hàng, kiểm tra')throw Error('Comma note split');
await dialog.getByRole('button',{name:'Sao chép bảng kèm tiêu đề'}).click();copied=await page.evaluate(()=>navigator.clipboard.readText());if(!copied.includes('M-IN-TDONG-0001\t2\t150.000,5'))throw Error('Copied values missing');
await dialog.getByRole('button',{name:'Xem trước',exact:true}).click();await dialog.getByText('150000.5',{exact:true}).waitFor();
await page.screenshot({path:'artifacts/quick-table-light.png',fullPage:false});
await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:'artifacts/quick-table-dark.png',fullPage:false});
await page.setViewportSize({width:390,height:900});const box=await dialog.boundingBox();if(box.x<0||box.x+box.width>390)throw Error('Quick import dialog overflow');await page.screenshot({path:'artifacts/quick-table-mobile.png',fullPage:false});
await dialog.getByRole('button',{name:'Thêm vào phiếu',exact:true}).click();await dialog.waitFor({state:'hidden'});if(await page.getByLabel('Đơn giá dòng 1',{exact:true}).inputValue()!=='150000,5')throw Error('Imported price lost');
if(errors.length)throw Error(errors.join(';'));console.log('Verified editable table, real clipboard headers + values, reordered Excel paste, commas inside notes/numbers, preview/apply, light/dark and mobile.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
