import {mkdirSync, existsSync, writeFileSync, chmodSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {root, signingDir, javaHome, run, signing} from './seeker-tools.mjs';

process.umask(0o077);
mkdirSync(signingDir, {recursive: true, mode: 0o700});
const configPath = join(signingDir, 'signing.json');
const keyPath = join(signingDir, 'pengucrush-seeker.p12');
if (!existsSync(configPath)) {
  if (existsSync(keyPath)) throw new Error('Keystore already exists without its configuration; refusing to replace it.');
  const password = randomBytes(32).toString('base64url');
  // Persist the recovery information before creating the key. Never print passwords.
  writeFileSync(configPath, JSON.stringify({file: 'pengucrush-seeker.p12', alias: 'pengucrush-seeker',
    storePassword: password, keyPassword: password, createdAt: new Date().toISOString()}, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  run(join(javaHome, 'bin/keytool'), ['-genkeypair', '-keystore', keyPath, '-storetype', 'PKCS12',
    '-storepass:env', 'PENGU_GENERATE_PASSWORD', '-keypass:env', 'PENGU_GENERATE_PASSWORD',
    '-alias', 'pengucrush-seeker', '-keyalg', 'RSA', '-keysize', '3072', '-sigalg', 'SHA256withRSA',
    '-validity', '10000', '-dname', 'CN=PenguCrush, O=Digital Chocolate', '-noprompt'],
    {env: {...process.env, PENGU_GENERATE_PASSWORD: password}});
  chmodSync(keyPath, 0o600);
  console.log(`Created private signing material in ${signingDir}`);
} else console.log('Reusing the existing Seeker signing key.');
const {config, env} = signing();
const publicDir = join(root, 'store/solana');
mkdirSync(publicDir, {recursive: true});
const cert = run(join(javaHome, 'bin/keytool'), ['-exportcert', '-rfc', '-keystore', env.PENGU_STORE_FILE,
  '-storepass:env', 'PENGU_STORE_PASSWORD', '-alias', config.alias], {env});
writeFileSync(join(publicDir, 'signing-certificate.cer'), cert, {mode: 0o644});
const info = run(join(javaHome, 'bin/keytool'), ['-list', '-v', '-keystore', env.PENGU_STORE_FILE,
  '-storepass:env', 'PENGU_STORE_PASSWORD', '-alias', config.alias], {env});
writeFileSync(join(publicDir, 'certificate-details.txt'), info, {mode: 0o644});
console.log(info);
