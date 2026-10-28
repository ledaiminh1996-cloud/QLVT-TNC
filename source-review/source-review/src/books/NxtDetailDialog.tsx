import {useEffect,useId,useRef,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import {docButton} from "../documents/CatalogPicker";
export const nxtDetailTitle="Chi tiết nhập xuất vật tư trong kỳ";
export function NxtDetailDialog({children,onClose}:{children:ReactNode;onClose:()=>void}){
 const root=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null),titleId=useId();
 useEffect(()=>{
  const dialog=root.current,previous=document.activeElement;
  dialog?.showModal();closeButton.current?.focus();
  return()=>{dialog?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true})};
 },[]);
 return createPortal(<dialog ref={root} aria-labelledby={titleId} className="nxt-detail-dialog rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl" onCancel={e=>{e.preventDefault();onClose()}} onKeyDown={e=>{
  if(e.key!=="Escape")return;
  // A document or filter opened inside this window handles its own Escape.
  const nested=e.target instanceof Element?e.target.closest('[aria-modal="true"]'):null;
  const popup=root.current?.querySelector('[aria-haspopup="dialog"][aria-expanded="true"],[role="combobox"][aria-expanded="true"],button[aria-label="Chọn kỳ sổ"][aria-expanded="true"]');
  if((nested&&nested!==root.current)||popup){e.preventDefault();return}
  e.preventDefault();onClose();
 }} aria-modal="true"><div className="flex h-full min-h-0 flex-col"><header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2"><h2 id={titleId} className="text-sm font-bold">{nxtDetailTitle}</h2><button ref={closeButton} type="button" className={docButton+' !px-2'} aria-label="Đóng chi tiết nhập xuất" onClick={onClose}><X size={16}/></button></header><div className="flex min-h-0 min-w-0 flex-1 flex-col p-3">{children}</div></div></dialog>,document.body);
}
