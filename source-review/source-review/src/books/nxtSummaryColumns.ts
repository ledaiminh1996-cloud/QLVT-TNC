/** Shared order for the summary screen, sticky totals, Excel and print. */
export const nxtSummaryColumns=[
 {key:'opening_quantity_milli',label:'Tồn đầu',money:false},
 {key:'opening_value_vnd',label:'Dư đầu',money:true},
 {key:'in_quantity_milli',label:'SL nhập',money:false},
 {key:'in_value_vnd',label:'Tiền nhập',money:true},
 {key:'out_quantity_milli',label:'SL xuất',money:false},
 {key:'out_value_vnd',label:'Tiền xuất',money:true},
 {key:'closing_quantity_milli',label:'Tồn cuối',money:false},
 {key:'closing_value_vnd',label:'Dư cuối',money:true},
] as const;

/** Compact labels stay fixed; remaining space goes to the material and money. */
export function nxtSummaryWidths(showMoney:boolean,availableWidth:number):string[]{
 const fields=nxtSummaryColumns.filter(c=>showMoney||!c.money);
 const fixed=88+96+36+84+88+fields.filter(c=>!c.money).length*60;
 const flexTotal=1.5+fields.filter(c=>c.money).length;
 const flex=(weight:number)=>`${Math.max(0,availableWidth-fixed)*weight/flexTotal}px`;
 return ['88px','96px',flex(1.5),'36px',...fields.map(c=>c.money?flex(1):'60px'),'84px','88px'];
}
