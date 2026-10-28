const base='https://qlvt.tannamchinh.workers.dev';
for(const path of ['/','/assets/index-DshVp6dj.js','/api/auth/me','/api/user-management']){const response=await fetch(base+path,{redirect:'manual'});const location=response.headers.get('location');console.log(JSON.stringify({path,status:response.status,redirect_to:location?new URL(location,base).hostname:null}));}
