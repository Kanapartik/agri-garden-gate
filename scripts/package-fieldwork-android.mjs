import {mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve('public/fieldwork'),target=resolve('mobile/fieldwork-android/app/src/main/assets/fieldwork');await mkdir(target,{recursive:true});for(const name of await readdir(source)){if(/\.(js|css|html|json|svg|webmanifest|md)$/.test(name))await copyFile(resolve(source,name),resolve(target,name));}console.log('Packaged offline fieldwork assets.');
