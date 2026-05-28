'use strict';

const path = require('path');

function resolveBackendEntry() {
  const packaged = process.env.LIANG_PACKAGED === '1';
  if (packaged) {
    return path.join(process.env.LIANG_RES, 'backend-enc', 'server.t8c');
  }
  return path.resolve(__dirname, '..', 'backend', 'src', 'server.js');
}

process.on('uncaughtException', (error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

require('./loader.cjs');
require(resolveBackendEntry());
