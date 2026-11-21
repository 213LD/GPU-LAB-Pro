import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Precomputed CRC32 table for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter None
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function sdRoundedBox(px, py, bx, by, r) {
  const dx = Math.abs(px) - bx + r;
  const dy = Math.abs(py) - by + r;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

function mix(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function renderGpuLabIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  // 2x2 supersampling per pixel for anti-aliased crisp vector look
  const sub = [-0.25, 0.25];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (const sy of sub) {
        for (const sx of sub) {
          // Normalized coords [-1, 1]
          const nx = ((x + 0.5 + sx) / size) * 2 - 1;
          const ny = ((y + 0.5 + sy) / size) * 2 - 1;

          // Outer rounded obsidian plate
          const plateDist = sdRoundedBox(nx, ny, 0.88, 0.88, 0.26);
          if (plateDist > 0.015) {
            continue;
          }

          const alpha = plateDist < 0 ? 1 : Math.max(0, 1 - plateDist / 0.015);

          // Dark gradient background (#0c130e -> #132216)
          const gradT = (nx * 0.4 + ny * 0.6 + 1) * 0.5;
          let r = mix(17, 10, gradT);
          let g = mix(34, 17, gradT);
          let b = mix(20, 13, gradT);

          // Subtle inner glow ring (#a3e635)
          const borderDist = Math.abs(sdRoundedBox(nx, ny, 0.80, 0.80, 0.21));
          if (borderDist < 0.032) {
            const bt = 1 - borderDist / 0.032;
            r = mix(r, 163, bt * 0.85);
            g = mix(g, 230, bt * 0.85);
            b = mix(b, 53, bt * 0.85);
          }

          // Ambient radial glow behind emblem
          const rad = Math.hypot(nx, ny);
          const glow = Math.max(0, 1 - rad / 0.85) ** 2.2 * 0.26;
          r = mix(r, 163, glow);
          g = mix(g, 230, glow);
          b = mix(b, 53, glow);

          // Stylized Turbine / "G" Emblem
          // Outer ring arc (open on upper-right like a stylized G)
          const angle = Math.atan2(ny, nx); // -PI..PI, right is 0, up is -PI/2
          const inGap = angle > -0.75 && angle < -0.05;
          const ringDist = Math.abs(rad - 0.44);
          let hitEmblem = false;

          if (!inGap && ringDist < 0.095) {
            hitEmblem = true;
          }
          // Horizontal G crossbar on right
          if (nx >= 0.02 && nx <= 0.53 && Math.abs(ny - 0.04) < 0.09) {
            hitEmblem = true;
          }
          // Vertical tip down from crossbar
          if (nx >= 0.36 && nx <= 0.53 && ny >= 0.04 && ny <= 0.38) {
            hitEmblem = true;
          }

          // Inner subtle fan blades inside the G ring
          const bladeAngle = angle + rad * 1.4;
          const bladeWave = Math.sin(bladeAngle * 5);
          if (!hitEmblem && rad > 0.12 && rad < 0.31 && bladeWave > 0.35) {
            r = mix(r, 132, 0.45);
            g = mix(g, 204, 0.45);
            b = mix(b, 22, 0.45);
          }
          // Center hub dot
          if (rad < 0.09) {
            r = mix(r, 190, 0.9);
            g = mix(g, 242, 0.9);
            b = mix(b, 100, 0.9);
          }

          if (hitEmblem) {
            // Crisp acid-lime metallic gradient (#bef264 -> #84cc16)
            const et = (ny + 0.55) / 1.1;
            r = mix(198, 132, et);
            g = mix(247, 204, et);
            b = mix(108, 22, et);
          }

          accR += r * alpha;
          accG += g * alpha;
          accB += b * alpha;
          accA += alpha;
        }
      }

      const idx = (y * size + x) * 4;
      const aNorm = accA / 4;
      if (aNorm > 0) {
        rgba[idx] = Math.round(accR / accA);
        rgba[idx + 1] = Math.round(accG / accA);
        rgba[idx + 2] = Math.round(accB / accA);
        rgba[idx + 3] = Math.round(aNorm * 255);
      }
    }
  }

  return encodePng(size, size, rgba);
}

function buildIco(sizes) {
  const images = sizes.map((size) => ({ size, png: renderGpuLabIcon(size) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(images.length, 4);

  const dirSize = 16 * images.length;
  let offset = 6 + dirSize;
  const dirBuffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry[0] = img.size >= 256 ? 0 : img.size;
    entry[1] = img.size >= 256 ? 0 : img.size;
    entry[2] = 0; // palette colors
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(img.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += img.png.length;
    dirBuffers.push(entry);
  }

  return Buffer.concat([header, ...dirBuffers, ...images.map((i) => i.png)]);
}

const outDir = path.join(rootDir, 'build');
fs.mkdirSync(outDir, { recursive: true });
const icoPath = path.join(outDir, 'icon.ico');
const icoBuf = buildIco([256, 128, 64, 48, 32, 16]);
fs.writeFileSync(icoPath, icoBuf);
console.log(`Generated ${icoPath} (${icoBuf.length} bytes)`);

const docsDir = path.join(rootDir, 'docs');
fs.mkdirSync(docsDir, { recursive: true });
const logoPng = renderGpuLabIcon(256);
const logoPath = path.join(docsDir, 'logo.png');
fs.writeFileSync(logoPath, logoPng);
console.log(`Generated ${logoPath} (${logoPng.length} bytes)`);
