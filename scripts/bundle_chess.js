const fs = require('fs');
const path = require('path');
const { buildSync } = require('esbuild');

const libDir = path.join(__dirname, '..', 'lib');
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

buildSync({
  entryPoints: [path.join(__dirname, '..', 'node_modules', 'chess.js', 'dist', 'esm', 'chess.js')],
  bundle: true,
  format: 'iife',
  globalName: 'ChessJs',
  outfile: path.join(libDir, 'chess.min.js'),
  minify: true,
  legalComments: 'inline'
});

console.log('Successfully bundled chess.js to lib/chess.min.js');
