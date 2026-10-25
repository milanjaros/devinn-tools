import {readFileSync,writeFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const report=[];
for(const [name,range] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){
  try{const info=JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`,import.meta.url),'utf8'));report.push({name,requested:range,installed:info.version,license:info.license,peers:info.peerDependencies||{},engines:info.engines||{}});}catch{throw new Error(`Chybí ${name}. Nejprve spusťte npm install.`);}
}
console.table(report.map(({name,installed,license})=>({name,installed,license})));
writeFileSync(new URL('../docs/installed-dependencies.json',import.meta.url),JSON.stringify(report,null,2));
