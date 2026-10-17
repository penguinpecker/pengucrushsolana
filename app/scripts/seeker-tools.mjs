import {existsSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const signingDir = resolve(process.env.PENGU_SIGNING_DIR || join(homedir(), '.config/pengucrushsolana/signing'));
export const javaHome = process.env.JAVA_HOME || '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
export const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || [
  join(homedir(), 'Library/Android/sdk'),
  '/Applications/Unity/Hub/Editor/6000.4.4f1/PlaybackEngines/AndroidPlayer/SDK',
].find(p => existsSync(join(p, 'platforms/android-36')));
export const buildTools = sdk && join(sdk, 'build-tools/36.0.0');
export const output = join(root, 'store/solana/upload');

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})\n${result.stdout || ''}\n${result.stderr || ''}`);
  return result.stdout || '';
}

export function signing() {
  const config = JSON.parse(readFileSync(join(signingDir, 'signing.json'), 'utf8'));
  const env = {...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk,
    PENGU_STORE_FILE: join(signingDir, config.file), PENGU_KEY_ALIAS: config.alias,
    PENGU_STORE_PASSWORD: config.storePassword, PENGU_KEY_PASSWORD: config.keyPassword};
  if (!existsSync(env.PENGU_STORE_FILE)) throw new Error('Signing keystore is missing; restore it from your private backup.');
  return {config, env};
}
