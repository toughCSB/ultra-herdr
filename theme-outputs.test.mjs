import {readFileSync} from 'node:fs';
import {applyTheme} from './apply.mjs';
import {omoTheme} from './omo-theme.mjs';
import {sidebarTheme} from './sidebar-theme.mjs';
import {terminalFontConfig} from './font.mjs';
import {sidebarMarkdownTheme,glowMarkdownTheme} from './markdown.mjs';
import {syncLabels} from './labels.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {getTheme,themeNames} from './themes.mjs';
const seed=readFileSync(new URL('./examples/herdr-config.example.toml',import.meta.url),'utf8');
// Captured from 8dad0b6 before the refactor; only externally rendered outputs.
const expected={
  "blue": {
    "herdr": "66a0973d647e7e67b2c0d077203e8225ef1e639b2c870dcd96ebb1a5a127ee6c",
    "omo": "8991208380981999c3c0783619895514a424910bc274e5c9f10d5af30b1a92e9",
    "sidebar": "5ded5b46de4a8d4f1d09a99264d8be195b96339074d1b2142cac62ac6127dc5c",
    "terminal": "ed8fe9cd0643df3820c97b973da2ae6798ddeea34411967071a9840746661c82",
    "markdown": "d07804e4467b627df2851008d2b7879150c575d84d1560794191245bab261d24",
    "glow": "580ed5095c36cc9a8bf45c6824752c38a4e711d73ae8246980f4b846169996ed",
    "metadata": "a5b7306c3f1091722d35130696b8174ae831b35fdbc45205156b41ee1efc7355"
  },
  "pink": {
    "herdr": "be9c7832ecaa54eda386f9a4715af4d91f646671080aa158e6756f9f53265405",
    "omo": "6bd1088f614978461f6f5e5a26bacbdcb91671514d4f8b88389fe694ae7f13d5",
    "sidebar": "dfd068a1d8f8273b996f836ff7a6abb936831500933c2300b54009d835e1b975",
    "terminal": "3fc49e54975a38a596ba724f8fce082c5287420682795cb94485d1caf5ad12f6",
    "markdown": "a07124b74b0e07ea2779db2e0c8ca7fe389613cde1349e2aa5e9d03ad6bd1bce",
    "glow": "7cffaaf5ba7a0417f767d00851f7e53c01b3d5a9f6c791bfdd4a11b573c0cbb8",
    "metadata": "61447c19457dacb8db077fc8b557ce770b2ff89ffda439025411d24ce554b407"
  },
  "red": {
    "herdr": "9a187038cc6295c008d3aeb25acb128a8165f9aa675fafff009b1573e13f1072",
    "omo": "80dec4de6c1b0294f10c7fd28e0188006ba54914940e15f91f9feef3d33e881e",
    "sidebar": "054a6c60ab2b5468169f61030e9fe36a1d9fc3cf205034ca3e2b92a078a03aa0",
    "terminal": "7628a2c4c32d62ebb8712b0be0501a0fc6fa7744fca9ce46eda5b2b922bca73f",
    "markdown": "d07804e4467b627df2851008d2b7879150c575d84d1560794191245bab261d24",
    "glow": "580ed5095c36cc9a8bf45c6824752c38a4e711d73ae8246980f4b846169996ed",
    "metadata": "ef78514c2764595b5caf84bcab3e99bb56f1eef8d7639733e0a03a5346c5c8d2"
  },
  "brown": {
    "herdr": "c45082d491eb8adf1087b543501e1ffd0bd265c00045a64a54f727ffcdd69cad",
    "omo": "08985c79a585cbe7b0cb02acae89bcd0f202e94ed23053f3f568c0ee55eb03db",
    "sidebar": "f8d4e951d98cd20b60acea16bd4db7acc52a31579830c5657f5fe8897db7a02f",
    "terminal": "cb19281b7787adfd2866a3aa7db13c1913d4e77b190fae9219f02284acc66e63",
    "markdown": "d07804e4467b627df2851008d2b7879150c575d84d1560794191245bab261d24",
    "glow": "580ed5095c36cc9a8bf45c6824752c38a4e711d73ae8246980f4b846169996ed",
    "metadata": "fcc3b73b20ab38226f7c4cb42c655f2ee779881c8618a2369c5f36f8eb3aa37d"
  }
};
for(const name of themeNames) test(`theme ${name} preserves every pre-refactor output`,async()=>{
 const writes=[];
 await syncLabels({themeName:name,localMachineLabel:'Fixture',run:async args=>{if(args[0]==='api')return JSON.stringify({result:{snapshot:{panes:[],agents:[],workspaces:[{workspace_id:'w1',tokens:{}}]}}});writes.push(args);return '';}});
 const output={herdr:applyTheme(seed,name),omo:omoTheme(name),sidebar:sidebarTheme(name),terminal:terminalFontConfig('{"profiles":{"list":[{"name":"Herdr","commandline":"keep","font":{"size":14}}]}}',14,name),markdown:sidebarMarkdownTheme('{"colors":"light","keep":true}',name),glow:glowMarkdownTheme('width: 100\n',name),metadata:writes};
 for(const [key,value] of Object.entries(output)) assert.equal(createHash('sha256').update(JSON.stringify(value)).digest('hex'),expected[name][key],key);
});
test('theme catalog rejects inherited object names',()=>{
 for(const name of ['constructor','toString','__proto__'])assert.throws(()=>getTheme(name),/Theme/);
 assert.equal(getTheme(),getTheme('blue'));
});
