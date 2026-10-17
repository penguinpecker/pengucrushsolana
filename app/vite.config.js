import { defineConfig } from 'vite';
import network from '../store/network.json' with {type:'json'};
export default defineConfig({ base: './', server: { host: '0.0.0.0', port: 4321, strictPort: true,
  proxy:{'/api':{target:network.apiOrigin,changeOrigin:true,rewrite:path=>path.replace(/^\/api/,'/v1')}}
}, build: { target: 'es2022' } });
