// Writes docs/install-qr.png, the QR code that downloads the latest APK on a phone.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer';

const URL_ = process.argv[2] ?? 'https://github.com/Nik-Kras/MamaKcal/releases/latest/download/MamaKcal.apk';
const require = createRequire(import.meta.url);
const wasm = await readFile(require.resolve('zxing-wasm/writer/zxing_writer.wasm'));
prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) } });
const res = await writeBarcode(URL_, { format: 'QRCode', scale: 14, addQuietZones: true });
if (res.error) throw new Error(res.error);
await writeFile(new URL('../docs/install-qr.png', import.meta.url), Buffer.from(await res.image.arrayBuffer()));
console.log('wrote docs/install-qr.png for', URL_);
