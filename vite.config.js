import {defineConfig} from 'vite';
const portalRoutes=new Set(['/plans','/login','/account','/checkout','/admin','/terms','/reset-password','/auth/callback']);
export default defineConfig({
  server:{allowedHosts:['terminal.local']},
  plugins:[{name:'smartconnect-routes',configureServer(server){server.middlewares.use((req,res,next)=>{const path=(req.url||'/').split('?')[0].replace(/\/$/,'')||'/';if(portalRoutes.has(path))req.url='/portal.html'+((req.url||'').includes('?')?'?'+req.url.split('?').slice(1).join('?'):'');else if(path==='/scan.html'||path==='/editor')req.url='/index.html'+((req.url||'').includes('?')?'?'+req.url.split('?').slice(1).join('?'):'');next();});}}],
  build:{rollupOptions:{input:{home:'index.html',portal:'portal.html',signup:'signup.html',offers:'pricing.html'}}}
});
