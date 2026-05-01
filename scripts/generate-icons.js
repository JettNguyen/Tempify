#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const defaultSource = path.join(
  projectRoot,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'AppIcon-512@2x.png'
)
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSource
const outputDir = path.join(projectRoot, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')

const iconSpecs = [
  { filename: 'AppIcon-20@1x.png', size: 20, idiom: 'ipad', scale: '1x' },
  { filename: 'AppIcon-20@2x.png', size: 40, idiom: 'iphone', scale: '2x' },
  { filename: 'AppIcon-20@2x-ipad.png', size: 40, idiom: 'ipad', scale: '2x' },
  { filename: 'AppIcon-20@3x.png', size: 60, idiom: 'iphone', scale: '3x' },

  { filename: 'AppIcon-29@1x.png', size: 29, idiom: 'ipad', scale: '1x' },
  { filename: 'AppIcon-29@2x.png', size: 58, idiom: 'iphone', scale: '2x' },
  { filename: 'AppIcon-29@2x-ipad.png', size: 58, idiom: 'ipad', scale: '2x' },
  { filename: 'AppIcon-29@3x.png', size: 87, idiom: 'iphone', scale: '3x' },

  { filename: 'AppIcon-40@1x.png', size: 40, idiom: 'ipad', scale: '1x' },
  { filename: 'AppIcon-40@2x.png', size: 80, idiom: 'iphone', scale: '2x' },
  { filename: 'AppIcon-40@2x-ipad.png', size: 80, idiom: 'ipad', scale: '2x' },
  { filename: 'AppIcon-40@3x.png', size: 120, idiom: 'iphone', scale: '3x' },

  { filename: 'AppIcon-60@2x.png', size: 120, idiom: 'iphone', scale: '2x' },
  { filename: 'AppIcon-60@3x.png', size: 180, idiom: 'iphone', scale: '3x' },

  { filename: 'AppIcon-76@1x.png', size: 76, idiom: 'ipad', scale: '1x' },
  { filename: 'AppIcon-76@2x.png', size: 152, idiom: 'ipad', scale: '2x' },
  { filename: 'AppIcon-83.5@2x.png', size: 167, idiom: 'ipad', scale: '2x' },

  { filename: 'AppIcon-1024@1x.png', size: 1024, idiom: 'ios-marketing', scale: '1x' },
]

function sizePoint(spec) {
  if (spec.idiom === 'ios-marketing') {
    return '1024x1024'
  }

  const pointSize = spec.size / Number.parseInt(spec.scale, 10)
  const pointStr = Number.isInteger(pointSize) ? `${pointSize}` : `${pointSize}`
  return `${pointStr}x${pointStr}`
}

async function main() {
  const meta = await sharp(sourcePath).metadata()
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error(`Source icon must be 1024x1024. Got ${meta.width}x${meta.height}: ${sourcePath}`)
  }

  await fs.mkdir(outputDir, { recursive: true })

  await Promise.all(
    iconSpecs.map(async (spec) => {
      const outFile = path.join(outputDir, spec.filename)
      await sharp(sourcePath)
        .resize(spec.size, spec.size, { fit: 'cover' })
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(outFile)
    })
  )

  const contents = {
    images: iconSpecs.map((spec) => ({
      size: sizePoint(spec),
      idiom: spec.idiom,
      filename: spec.filename,
      scale: spec.scale,
    })),
    info: {
      version: 1,
      author: 'xcode',
    },
  }

  await fs.writeFile(
    path.join(outputDir, 'Contents.json'),
    `${JSON.stringify(contents, null, 2)}\n`,
    'utf8'
  )

  console.log(`Generated ${iconSpecs.length} icons in: ${outputDir}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
