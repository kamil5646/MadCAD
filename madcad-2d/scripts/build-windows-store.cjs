'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
const submissionBuild = process.env.MADCAD_STORE_SUBMISSION === '1';
const identityName = String(process.env.MADCAD_STORE_IDENTITY_NAME || 'MadCAD2D.StoreTest').trim();
const publisher = String(process.env.MADCAD_STORE_PUBLISHER || 'CN=ms').trim();

if (submissionBuild && (!process.env.MADCAD_STORE_IDENTITY_NAME || !process.env.MADCAD_STORE_PUBLISHER)) {
  throw new Error(
    'Build do wysłania wymaga MADCAD_STORE_IDENTITY_NAME i MADCAD_STORE_PUBLISHER skopiowanych z Partner Center.'
  );
}
if (!/^[A-Za-z0-9.-]{3,50}$/.test(identityName)) {
  throw new Error(`Nieprawidłowa tożsamość pakietu Microsoft Store: ${identityName}`);
}
if (!/^CN=.+/.test(publisher)) {
  throw new Error('Wydawca Microsoft Store musi zaczynać się od CN=.');
}

const result = spawnSync(
  process.execPath,
  [
    electronBuilderCli,
    '--win',
    'appx',
    '--x64',
    '--publish',
    'never',
    `-c.appx.identityName=${identityName}`,
    `-c.appx.publisher=${publisher}`,
  ],
  {
    cwd: appRoot,
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
    stdio: 'inherit',
  }
);

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status || 1;
