import fs from 'node:fs';
import { builtinModules } from 'node:module';
import ts from 'typescript';
import { runtimeDependencies } from './desktop-runtime.mjs';
const builtins = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`), 'electron']);
for (const file of fs.readdirSync('dist-electron').filter(name => name.endsWith('.js'))) {
 const tree = ts.createSourceFile(file, fs.readFileSync(`dist-electron/${file}`, 'utf8'), ts.ScriptTarget.Latest);
 function visit(node) {
  let name;
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) name = node.moduleSpecifier.text;
  if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) && node.arguments.length && ts.isStringLiteral(node.arguments[0])) name = node.arguments[0].text;
  if (name && !name.startsWith('.') && !builtins.has(name)) {
   const pkg = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
   if (!runtimeDependencies.includes(pkg)) throw new Error(`Unpackaged desktop external: ${name} in ${file}`);
  }
  ts.forEachChild(node, visit);
 }
 visit(tree);
}
console.log('Emitted desktop imports are covered by the runtime manifest');
