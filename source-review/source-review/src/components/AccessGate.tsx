import {PasswordLoginForm,PasswordChangeForm,LogoutButton} from "./PasswordForms";
import type {NativeAuthClient} from "../api/nativeAuthClient";
import { ArrowRight, Mail, RefreshCw, ShieldCheck, UserRound, LoaderCircle } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { TncLogo } from "./TncLogo";
import { LoginLandscape } from "./LoginLandscape";
import { userRoles } from "../../shared/userAccess";
import { accessMessage, CatalogApiError, type Session } from "../api/catalogClient";
export function AccessGate({checking,error,session,onRetry,onEnter,onAuthenticated,auth,activationToken,onActivationCancel}:{checking:boolean;error:unknown;session:Session|null;onRetry:()=>void;onEnter?:()=>void;onAuthenticated?:()=>void|Promise<void>;auth?:NativeAuthClient;activationToken?:string;onActivationCancel?:()=>void}){
 const signedIn=!!session?.identity.email,ready=!!session?.access_granted&&!!session.user&&!error;
 const needsLogin=!signedIn||(error instanceof CatalogApiError&&error.status===401);
 const gateFailure=!!error&&!(error instanceof CatalogApiError&&error.status===401);
 const mustChange=!!session?.must_change_password;
 return <main className="access-entrance"><section className="access-entrance-card" aria-label="Đăng nhập QLVT">
 <div className="access-entrance-art"><LoginLandscape/><div className="access-entrance-brand"><div className="access-entrance-logo"><TncLogo size="sm" showSubtitle/></div><span>TÂN NAM CHINH<br/>LOGISTICS</span></div><div className="access-entrance-story"><h2>Kết nối vật tư.<br/>Chủ động vận hành.</h2><p>Quản lý kho, phương tiện và thiết bị trên một hệ thống thống nhất.</p><i aria-hidden="true"/></div></div>
 <div className="access-entrance-panel"><div className="access-entrance-theme"><ThemeToggle/></div><p className="entry-overline">HỆ THỐNG QUẢN LÝ VẬT TƯ</p><h1>{activationToken?'Thiết lập quản trị':mustChange?'Đổi mật khẩu tạm':ready?'Chào mừng trở lại':signedIn?'Kiểm tra quyền truy cập':'Đăng nhập hệ thống'}</h1><p className="entry-subtitle">{mustChange?'Tạo mật khẩu riêng trước khi bắt đầu sử dụng.':ready?'Sẵn sàng bắt đầu công việc của bạn tại Tân Nam Chinh.':'Đăng nhập bằng email và mật khẩu được quản trị cấp.'}</p>
 {!needsLogin&&!activationToken&&<div className="access-entrance-account">{signedIn?<UserRound size={20}/>:<Mail size={20}/>}<div>{signedIn?<><span>{ready&&session?.user?userRoles[session.user.role]:'Email đã xác thực'}</span><strong>{session?.user?.display_name||session?.identity.email}</strong>{ready&&<span className="mt-1 break-all">{session?.identity.email}</span>}</>:<><span>Tài khoản đăng nhập</span><strong>Email được quản trị cấp quyền</strong></>}</div></div>}
 {checking?<p role="status" className="access-entrance-message flex items-center gap-2"><LoaderCircle size={14} className="animate-spin"/>Đang kiểm tra phiên đăng nhập…</p>:<>
 {!ready&&!activationToken&&(gateFailure||signedIn)&&<p role="alert" className="access-entrance-message">{error?accessMessage(error):'Bạn đã đăng nhập nhưng chưa được cấp tài khoản hoạt động trong ứng dụng. Hãy liên hệ người quản trị.'}</p>}
 {mustChange?<PasswordChangeForm auth={auth} onSuccess={onAuthenticated??(()=>window.location.assign('/'))}/>:activationToken||needsLogin?<PasswordLoginForm auth={auth} activationToken={activationToken} onCancel={onActivationCancel} onSuccess={onAuthenticated??(()=>window.location.assign('/'))}/>:ready&&onEnter?<button type="button" className="access-entrance-primary" onClick={onEnter}><span>Vào phần mềm</span><span><ArrowRight size={18}/></span></button>:null}
 {!ready&&!activationToken&&(gateFailure||signedIn)&&<button type="button" className="access-entrance-retry" onClick={onRetry}><RefreshCw size={13}/>Kiểm tra lại</button>}
 {signedIn&&<LogoutButton className="access-entrance-switch"/>}</>}
 <div className="access-entrance-divider"/><p className="access-entrance-footer"><ShieldCheck size={15}/><span>Đăng nhập bảo mật tại Tân Nam Chinh.<br/>Liên hệ quản trị nếu bạn chưa có quyền truy cập.</span></p></div></section></main>;
}
