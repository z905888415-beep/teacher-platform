// 生成 PWA 图标（纯 Node，无依赖）：蓝色圆角方块 + 白色书本图形
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // 每行前置 filter byte = 0
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- 绘制图标 ----------
const BRAND = [37, 99, 235, 255] // #2563eb
const WHITE = [255, 255, 255, 255]
const TRANSPARENT = [0, 0, 0, 0]

function inRoundedRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false
  const cx = Math.min(Math.max(x, r), w - 1 - r)
  const cy = Math.min(Math.max(y, r), h - 1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function drawIcon(size) {
  const ss = 2 // 2x 超采样抗锯齿
  const W = size * ss
  const px = Buffer.alloc(W * W * 4)
  const setPx = (x, y, c) => {
    const i = (y * W + x) * 4
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3]
  }
  const radius = W * 0.18
  // 书本（白底 + 蓝线条）
  const bw = W * 0.5, bh = W * 0.58
  const bx = (W - bw) / 2, by = (W - bh) / 2
  const br = W * 0.06
  const lines = [
    { y: by + bh * 0.3, w: bw * 0.72 },
    { y: by + bh * 0.5, w: bw * 0.72 },
    { y: by + bh * 0.7, w: bw * 0.45 },
  ]

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let c = TRANSPARENT
      if (inRoundedRect(x, y, W, W, radius)) {
        c = BRAND
        // 书本白底
        if (x >= bx && x < bx + bw && y >= by && y < by + bh && inRoundedRect(x - bx, y - by, bw, bh, br)) {
          c = WHITE
        }
      }
      setPx(x, y, c)
    }
  }
  // 书本上的蓝色线条
  const stroke = W * 0.045
  for (const ln of lines) {
    const lx = (W - ln.w) / 2
    for (let y = Math.floor(ln.y - stroke / 2); y < ln.y + stroke / 2; y++) {
      for (let x = Math.floor(lx); x < lx + ln.w; x++) {
        if (x >= 0 && y >= 0 && x < W && y < W) setPx(x, y, BRAND)
      }
    }
  }

  // 降采样回目标尺寸
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const i = ((y * ss + sy) * W + (x * ss + sx)) * 4
          r += px[i]; g += px[i + 1]; b += px[i + 2]; a += px[i + 3]
        }
      }
      const n = ss * ss
      const o = (y * size + x) * 4
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n
    }
  }
  return encodePng(size, size, out)
}

writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512))
writeFileSync(join(outDir, 'apple-touch-icon.png'), drawIcon(180))
console.log('✅ PWA 图标已生成到 public/icons/')
