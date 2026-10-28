import {nativeAuthClient,type NativeAuthClient} from "../api/nativeAuthClient";
import { useEffect, useState } from "react";
import { createCatalogClient, CatalogApiError, type CatalogClient, type Session } from "../api/catalogClient";
import { AccessGate } from "./AccessGate";
const client=createCatalogClient();
/** An explicit entrance before mounting any inventory screens; the server remains authoritative. */
export function AppEntrance({onEnter,api=client,auth=nativeAuthClient}:{onEnter:()=>void;api?:CatalogClient;auth?:NativeAuthClient}){
 const [activationToken,setActivationToken]=useState(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get('setup')??'';return /^[a-f0-9]{64}$/.test(value)?value:''});
 useEffect(()=>{const update=()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get('setup')??'';setActivationToken(/^[a-f0-9]{64}$/.test(value)?value:'')};window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update)},[]);
 const [checking,setChecking]=useState(true),[session,setSession]=useState<Session|null>(null),[error,setError]=useState<unknown>(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const c=new AbortController();setChecking(true);setSession(null);setError(null);api.session(c.signal).then(value=>{if(!c.signal.aborted)setSession(value)}).catch(e=>{if(!c.signal.aborted)setError(e)}).finally(()=>{if(!c.signal.aborted)setChecking(false)});return()=>c.abort();},[api,attempt]);
 async function authenticated(){const value=await api.session();setSession(value);setError(null);setActivationToken('');if(window.location.hash)window.history.replaceState(null,'',window.location.pathname+window.location.search);if(value.access_granted&&value.user&&!value.must_change_password)onEnter();}
 return <AccessGate auth={auth} activationToken={activationToken} onActivationCancel={()=>{setActivationToken('');window.history.replaceState(null,'',window.location.pathname+window.location.search)}} onAuthenticated={authenticated} checking={checking} session={session} error={error} onRetry={()=>setAttempt(n=>n+1)} onEnter={session?.access_granted&&session.user&&!error&&!session.must_change_password?onEnter:undefined}/>;
}
