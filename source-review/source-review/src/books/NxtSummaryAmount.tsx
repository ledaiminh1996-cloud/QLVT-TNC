import {Fragment} from "react";
import {formatBookCell} from "./bookColumns";
/** Keep every digit; soft breaks occur only between thousands groups. */
export function NxtSummaryNumber({value,money=false}:{value:number|null|undefined;money?:boolean}){
 if(value==null)return <span className="nxt-unknown" title="Chưa xác định giá trị">–</span>;
 if(value===0)return <span className="nxt-zero" title="0">–</span>;
 const formatted=formatBookCell(value,money?'money':'quantity'),groups=formatted.split('.');
 return <span className="nxt-number" title={formatted+(money?' đ':'')}>{groups.map((group,i)=><Fragment key={i}>{i>0&&<wbr/>}<span className="nxt-number-group">{group}{i<groups.length-1?'.':money?' đ':''}</span></Fragment>)}</span>;
}
