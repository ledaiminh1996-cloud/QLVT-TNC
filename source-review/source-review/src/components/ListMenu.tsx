import {useEffect,useRef,useState,type ReactNode} from "react";
import {ChevronDown} from "lucide-react";
import {docButton} from "../documents/CatalogPicker";
export function ListMenu({label,icon,children}:{label:string;icon:ReactNode;children:ReactNode}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);button.current?.focus()}};document.addEventListener("mousedown",outside);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",escape)}},[open]);
 return <div ref={root} className="relative min-w-0"><button ref={button} type="button" className={docButton+" w-full !px-2"} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{icon}{label}<ChevronDown size={12}/></button>{open&&<div role="dialog" aria-label={label} className="absolute right-0 top-full z-30 mt-1 w-64 max-w-[85vw] space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">{children}</div>}</div>
}
