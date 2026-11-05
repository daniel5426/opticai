// Only packages intentionally left external by the Electron main-process bundle.
// Renderer libraries are already compiled into dist and must not be shipped twice.
export const runtimeDependencies = ['better-sqlite3', 'cors', 'express', 'googleapis'];
export function runtimeManifest(pkg, lock) {
 return {
  name: pkg.name, productName: pkg.productName, version: pkg.version,
  description: pkg.description, main: pkg.main, author: pkg.author, license: pkg.license,
  dependencies: Object.fromEntries(runtimeDependencies.map(name => {
   const version = lock.packages[`node_modules/${name}`]?.version;
   if (!version || !pkg.dependencies[name]) throw new Error(`Missing desktop runtime dependency: ${name}`);
   return [name, version];
  })),
 };
}
