import {mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash, X509Certificate} from 'node:crypto';
import {root, sdk, buildTools, javaHome, output, run, signing} from './seeker-tools.mjs';

if (!sdk) throw new Error('Set ANDROID_HOME to an SDK containing Android API 36.');
const {env} = signing();
const pkg = JSON.parse(readFileSync(join(root, 'app/package.json')));
const publisher = JSON.parse(readFileSync(join(root, 'store/publisher.json')));
if (!publisher.publisherName || !publisher.supportEmail || !['13+', 'mixed'].includes(publisher.audience)) {
  throw new Error('Configure publisher identity, support email and audience before building the Seeker release.');
}
const firebaseConfigured = existsSync(join(root, 'android-app/app/google-services.json'));
if (firebaseConfigured !== (publisher.cloudMessaging === true)) {
  throw new Error('Firebase configuration and the publisher cloudMessaging disclosure must agree.');
}
for (const script of ['build', 'android:sync']) run('npm', ['run', script], {cwd: join(root, 'app'), stdio: 'inherit'});
run('./gradlew', [':app:assembleRelease', ':app:testDebugUnitTest', ':app:lintRelease', '-PseekerRelease', '--console=plain'],
  {cwd: join(root, 'android-app'), env, stdio: 'inherit'});
mkdirSync(output, {recursive: true});
const apkName = `PenguCrush-Seeker-${pkg.version}.apk`;
const apkPath = join(output, apkName);
copyFileSync(join(root, 'android-app/app/build/outputs/apk/release/app-release.apk'), apkPath);
const publicEnv = {...process.env, JAVA_HOME: javaHome};
const verification = run(join(buildTools, 'apksigner'), ['verify', '--verbose', '--print-certs', apkPath], {env: publicEnv});
const badging = run(join(buildTools, 'aapt'), ['dump', 'badging', apkPath]);
const manifest = run(join(buildTools, 'aapt'), ['dump', 'xmltree', apkPath, 'AndroidManifest.xml']);
run(join(buildTools, 'zipalign'), ['-c', '-P', '16', '4', apkPath]);
if (/CN=Android Debug/.test(verification)) throw new Error('Refusing a debug certificate.');
if (/android:debuggable.*0xffffffff/.test(manifest)) throw new Error('Refusing a debuggable APK.');
if (manifest.includes('NotificationTestReceiver')) throw new Error('Debug receiver found in release.');
if (!badging.includes("package: name='com.pengucrush.islands'") || !badging.includes(`versionName='${pkg.version}'`)) throw new Error('Unexpected APK identity.');
const cert = new X509Certificate(readFileSync(join(root, 'store/solana/signing-certificate.cer')));
const fingerprint = cert.fingerprint256.replaceAll(':', '').toLowerCase();
if (!verification.includes(`certificate SHA-256 digest: ${fingerprint}`)) throw new Error('APK signer does not match the exported certificate.');
const hash = createHash('sha256').update(readFileSync(apkPath)).digest('hex');
writeFileSync(join(output, 'APK-SIGNATURE.txt'), verification);
writeFileSync(join(output, 'APK-METADATA.txt'), badging);
writeFileSync(join(output, 'SHA256SUMS.txt'), `${hash}  ${apkName}\n`);
writeFileSync(join(output, 'verification.json'), JSON.stringify({apk: apkName, packageName: 'com.pengucrush.islands',
  versionName: pkg.version, versionCode: 8, sha256: hash, certificateSha256: fingerprint,
  certificateMatches: true, debugCertificate: false, debuggable: false, debugReceiver: false,
  zipAlignment16KB: true, nativeUnitTests: 'passed', androidLint: 'passed', builtAt: new Date().toISOString(),
  physicalSeekerTest: 'pending', portalSubmitted: false}, null, 2) + '\n');
console.log(`Verified signed release: ${apkPath}`);
