import {scaledDecimal,type DraftLine} from "./documents.ts";
export function hasOpeningAssessment(line:DraftLine){return !![line.opening_current_unit_price,line.opening_quality_percent,line.opening_assessor,line.opening_confirmation_basis].some(value=>value?.trim());}
/** Opening management value from entered/catalog original price, remaining ratio and named assessor. */
export function openingUsageAssessment(line:DraftLine){
 const current=line.opening_current_unit_price??"",quality=line.opening_quality_percent??"",assessor=line.opening_assessor?.trim()??"",confirmation=line.opening_confirmation_basis?.trim()??"";
 const price=current?scaledDecimal(current,3,"Nguyên giá"):null,percent=quality?scaledDecimal(quality,2,"Chất lượng"):null,q=line.quantity?scaledDecimal(line.quantity,3,"Số lượng"):null;
 if(price!==null&&price<=0n)throw new Error("Nguyên giá phải lớn hơn 0.");
 if(percent!==null&&percent>10000n)throw new Error("Chất lượng phải từ 0 đến 100%.");
 const complete=price!==null&&percent!==null&&q!==null&&q>0n&&!!assessor;
 const amount=complete?Number((price!*q!*percent!+5000000000n)/10000000000n):null;
 if(amount!==null&&(!Number.isSafeInteger(amount)||amount>9000000000000))throw new Error("Giá trị còn lại vượt giới hạn.");
 return {version:2,basis:"opening_price_quality",valuation_status:complete?"known":"pending",current_unit_price_vnd_milli:price===null?null:String(price),quality_percent:quality||null,quantity_milli:q===null?null:Number(q),assessor,confirmation_basis:confirmation,amount_vnd:amount};
}

export function openingUsageTotals(lines:DraftLine[]){
 let quantity=0n,base=0n,remaining=0n;let missingBase=0,missingRemaining=0;
 for(const line of lines){const q=scaledDecimal(line.quantity,3,"Số lượng")??0n;quantity+=q;
  const price=line.opening_current_unit_price?scaledDecimal(line.opening_current_unit_price,3,"Nguyên giá"):null;
  if(price===null)missingBase++;else base+=(price*q+500000n)/1000000n;
  const amount=openingUsageAssessment(line).amount_vnd;if(amount===null)missingRemaining++;else remaining+=BigInt(amount);
 }
 for(const value of [quantity,base,remaining])if(value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Tổng cộng vượt giới hạn.");
 return {quantity_milli:Number(quantity),base_vnd:missingBase?null:Number(base),remaining_vnd:missingRemaining?null:Number(remaining),missing_base:missingBase,missing_remaining:missingRemaining};
}
