import {readFile, stat, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash, X509Certificate} from 'node:crypto';
import sharp from 'sharp';
import {root, output, buildTools, javaHome, run} from './seeker-tools.mjs';

const listingRoot = join(root, 'store/solana');
const listing = JSON.parse(await readFile(join(listingRoot, 'listing.json')));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
for (const field of ['dappName', 'subtitle', 'description', 'publisherName', 'contactEmail', 'supportEmail', 'appWebsite', 'licenseUrl', 'privacyPolicyUrl']) check(!!listing[field]?.trim(), `Missing ${field}`);
check(listing.dappName.length <= 25, 'App name exceeds 25 characters');
check(listing.subtitle.length <= 50, 'Subtitle exceeds 50 characters');
check(listing.languages?.includes('en-US'), 'English listing language missing');
check(listing.screenshots.length >= 4 && listing.screenshots.length <= 8, 'Provide 4–8 previews');
for (const [field, width, height] of [['icon', 512, 512], ['banner', 1200, 600]]) {
  try {
    const file = sharp(join(listingRoot, listing[field]));
    const m = await file.metadata();
    check(m.width === width && m.height === height, `${field}: expected ${width}×${height}`);
    check((await file.stats()).isOpaque, `${field} must be opaque`);
  } catch { failures.push(`Missing or unreadable ${field}`); }
}
let dimensions;
for (const name of listing.screenshots) {
  try {
    const m = await sharp(join(listingRoot, name)).metadata();
    const size = `${m.width}x${m.height}`;
    dimensions ||= size;
    check(size === dimensions, 'All previews must have the same dimensions');
    check(m.width >= 1080 && m.height > m.width, `${name}: expected high-resolution portrait preview`);
  } catch { failures.push(`Missing screenshot: ${name}`); }
}
let apk;
try {
  apk = JSON.parse(await readFile(join(output, 'verification.json')));
  const apkPath = join(output, apk.apk);
  check(createHash('sha256').update(await readFile(apkPath)).digest('hex') === apk.sha256, 'APK checksum changed since verification');
  const cert = new X509Certificate(await readFile(join(listingRoot, 'signing-certificate.cer')));
  check(cert.fingerprint256.replaceAll(':', '').toLowerCase() === apk.certificateSha256, 'Certificate mismatch');
  const verification = run(join(buildTools, 'apksigner'), ['verify', '--print-certs', apkPath], {env: {...process.env, JAVA_HOME: javaHome}});
  check(verification.includes(apk.certificateSha256), 'APK signer mismatch');
  check(apk.versionName === listing.versionName && apk.versionCode === listing.versionCode, 'Listing version does not match APK');
  check(!apk.debuggable && !apk.debugCertificate, 'Release must not be debuggable or use a debug certificate');
  apk.bytes = (await stat(apkPath)).size;
} catch (e) { failures.push(`APK verification failed: ${e.message}`); }
const urls = [];
let onlineServices=null;
if (process.argv.includes('--online')) {
  try {
    const network=JSON.parse(await readFile(join(root,'store/network.json')));
    const response=await fetch(`${network.apiOrigin}/health`,{signal:AbortSignal.timeout(20000)});
    onlineServices=await response.json();check(response.ok&&onlineServices.ok,'Railway API health check failed');
  } catch(e){failures.push(`Online services: ${e.message}`);}
  for (const key of ['appWebsite', 'licenseUrl', 'privacyPolicyUrl', 'supportUrl', 'deletionUrl']) {
    try {
      const url = listing[key];
      check(new URL(url).protocol === 'https:', `${key} must use HTTPS`);
      const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
      const body = await response.text();
      const ready = response.ok && response.headers.get('content-type')?.includes('text/html') && /pengucrush/i.test(body) && !body.includes('Preview policy:');
      check(ready, `Public page not ready: ${url}`);
      urls.push({url, status: response.status, ready: !!ready});
    } catch (e) { failures.push(`${key}: ${e.message}`); }
  }
}
const report = {checkedAt: new Date().toISOString(), localPackageReady: failures.length === 0,
  onlineChecked: process.argv.includes('--online'), failures, screenshotDimensions: dimensions, urls, onlineServices,
  apk: apk && {name: apk.apk, bytes: apk.bytes, sha256: apk.sha256, certificateSha256: apk.certificateSha256},
  portalSubmitted: false,
  remainingPublisherSteps: [...(onlineServices&&!onlineServices.paymentsEnabled?['Configure the publisher-approved receiving public address in Railway SOLANA_TREASURY to enable live payments']:[]), 'Sign in to the Publisher Portal and complete KYC/KYB if pending',
    'Confirm publisher profile, intended audience and distribution countries',
    'Connect the publisher wallet and fund the chosen storage provider',
    'Create the app listing, upload the APK and approve the portal wallet requests',
    'Complete a physical Seeker smoke test before submitting for review']};
await mkdir(output, {recursive: true});
await writeFile(join(output, 'preflight.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
