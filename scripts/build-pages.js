const fs=require('node:fs');
const path=require('node:path');
const out=path.resolve(__dirname,'../dist');
fs.mkdirSync(out,{recursive:true});
const base=(process.env.PAGES_BASE_PATH||'').replace(/\/$/,'');
if(base && !/^\/[A-Za-z0-9_.-]+$/.test(base))throw Error('Invalid Pages base path');
const root=path.resolve(__dirname,'..');
const files=['index.html','premium.html','education-detail.html','promotion.html','result-preview.html','report-sample.html','privacy-policy.html','premium.css','premium-game.css','report-gallery.css','result-theme.css','report-theme.css','report-sample.js','premium.js'];
for(const file of files){let body=fs.readFileSync(path.join(root,file),'utf8');body=body.replace(/((?:href|src)=['"])\/(?!\/)/g,`$1${base}/`);if(file.endsWith('.js'))body=body.replace(/fetch\('\/(?!\/)/g,`fetch('${base}/`);fs.writeFileSync(path.join(out,file),body);}
fs.cpSync(path.join(root,'exports'),path.join(out,'exports'),{recursive:true});
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
fs.mkdirSync(path.join(out,'api/payment-config'),{recursive:true});
fs.writeFileSync(path.join(out,'api/payment-config/index.html'),JSON.stringify({available:false,price:9900,originalPrice:50000,currency:'KRW'}));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Static preview ready: dist (payments and SMS remain disabled)');
