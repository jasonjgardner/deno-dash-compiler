import { default as dashPackageJson } from 'https://raw.githubusercontent.com/bridge-core/dash-compiler/main/package.json' assert { type: 'json' };
import importMap from './importMap.json' assert { type: 'json' };

const swcVersion = dashPackageJson.dependencies['@swc/wasm-web'];
const version = swcVersion.startsWith('^')
	? swcVersion.slice(1)
	: swcVersion ?? 'latest';

console.log(`Updating @swc/wasm-web to ${version}`);

importMap.imports['@swc/wasm-web'] = importMap.imports['@swc/wasm-web'].replace(
	/@.*/,
	`@swc/wasm-web@${version}`,
);

await Deno.writeTextFile(
	'./importMap.json',
	JSON.stringify(importMap, undefined, '\t'),
);

console.log(
	'Done! Please run `deno cache --reload ./importMap.json` to update the import map.',
);
