import {StockLedger} from "./StockLedger";
import {NxtBooks} from "./NxtBooks";
export function InventoryBooks(props:Parameters<typeof NxtBooks>[0]){return props.book==='stock'?<StockLedger api={props.api} documents={props.documents}/>:<NxtBooks {...props}/>}
