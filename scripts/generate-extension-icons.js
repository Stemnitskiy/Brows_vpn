#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..', 'extension');
const ICONS_DIR = path.join(ROOT, 'icons');
const SIZES = [16, 48, 128];
const BG = { r: 0x42, g: 0x85, b: 0xf4, a: 255 };
const WHITE = { r: 255, g: 255, b: 255, a: 255 };

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crcInput = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function insideRoundedRect(x, y, size, radius) {
  const rx = Math.min(radius, size / 2);
  const left = rx;
  const right = size - rx - 1;
  const top = rx;
  const bottom = size - rx - 1;

  if (x >= left && x <= right) return true;
  if (y >= top && y <= bottom) return true;

  const corners = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom]
  ];
  for (const [cx, cy] of corners) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= rx * rx) return true;
  }
  return false;
}

function drawPowerSymbol(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 128;
  const lineHalf = Math.max(0.8, 1.4 * scale);
  const lineTop = cy - 18 * scale;
  const lineBottom = cy + 2 * scale;

  if (x >= cx - lineHalf && x <= cx + lineHalf && y >= lineTop && y <= lineBottom) {
    return true;
  }

  const arcRadius = 22 * scale;
  const arcCenterY = cy + 4 * scale;
  const dx = x - cx;
  const dy = y - arcCenterY;
  const dist = Math.hypot(dx, dy);
  const ring = Math.max(1.2 * scale, 2.2 * scale);
  if (dist >= arcRadius - ring && dist <= arcRadius + ring && dy <= arcCenterY + 2 * scale) {
    const angle = Math.atan2(dy, dx);
    return angle >= -Math.PI * 0.82 && angle <= Math.PI * 0.82;
  }
  return false;
}

function createIconPixels(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = (16 * size) / 128;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      if (!insideRoundedRect(x, y, size, radius)) {
        rgba[idx + 3] = 0;
        continue;
      }
      const color = drawPowerSymbol(x + 0.5, y + 0.5, size) ? WHITE : BG;
      rgba[idx] = color.r;
      rgba[idx + 1] = color.g;
      rgba[idx + 2] = color.b;
      rgba[idx + 3] = color.a;
    }
  }
  return rgba;
}

function encodePng(size) {
  const rgba = createIconPixels(size);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

for (const size of SIZES) {
  const out = path.join(ICONS_DIR, `icon${size}.png`);
  fs.writeFileSync(out, encodePng(size));
  console.log(`Wrote ${out}`);
}
