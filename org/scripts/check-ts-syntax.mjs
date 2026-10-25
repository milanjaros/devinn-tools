import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
let checked=0;
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())walk(path);else if(path.endsWith('.ts')&&!path.endsWith('.d.ts')){stripTypeScriptTypes(readFileSync(path,'utf8'),{mode:'transform',sourceUrl:path});checked++;}}}
walk('src');walk('e2e');for(const path of ['vite.config.ts','playwright.config.ts']){stripTypeScriptTypes(readFileSync(path,'utf8'),{mode:'transform',sourceUrl:path});checked++;}
console.log(`Syntaxe ${checked} souborů .ts je platná. Toto není typová kontrola a nezahrnuje JSX.`);
