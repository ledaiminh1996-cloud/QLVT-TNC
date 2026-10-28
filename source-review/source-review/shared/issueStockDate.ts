/** Availability follows the local date and time explicitly shown in receipt/issue forms. */
export function issueStockCutoff(value:string):string {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(Date.parse(value+":00Z")) || new Date(value+":00Z").toISOString().slice(0,16)!==value)throw new Error("Ngày chứng từ không hợp lệ.");
 return value;
}

export function issueStockTimeLabel(value:string):string {
 return value.slice(0,10).split("-").reverse().join("/")+" "+value.slice(11,16);
}
