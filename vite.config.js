import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { GAME_BY_SLUG } from './src/lib/games.js'
import { gamePage, appPage, APP_PAGES } from './scripts/game-pages.js'

// Writes game/<slug>.html beside index.html once the build is out, so each
// game's link answers with its own preview instead of GitHub Pages' 404. The
// app's other fixed pages (privacy.html, terms.html and the rest) get the
// same, so they answer with a 200 too.
function gamePages() {
  let outDir
  return {
    name: 'tempify-game-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const index = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      mkdirSync(resolve(outDir, 'game'), { recursive: true })
      for (const game of Object.values(GAME_BY_SLUG)) {
        writeFileSync(resolve(outDir, `${game.path.slice(1)}.html`), gamePage(index, game))
      }
      for (const name of APP_PAGES) {
        writeFileSync(resolve(outDir, `${name}.html`), appPage(index, name))
      }
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Deezer answers no browser, so a site built without the proxy has no song
  // search at all. The web went out that way until 11/2/2026 without anyone
  // seeing an error, so a build without it stops here instead.
  if (command === 'build' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_DEEZER_PROXY_URL) {
    throw new Error('VITE_DEEZER_PROXY_URL is missing, so song search would not work. Add it to .env, or to the deploy for the web.')
  }
  return {
    plugins: [react(), gamePages()],
    base: '/',
    // Claude Code keeps worktrees under .claude/, each a full copy of the
    // repo. Without this, the tests run once more for every copy, old ones too.
    test: {
      exclude: [...configDefaults.exclude, '.claude/**'],
    },
    server: {
      proxy: {
        '/deezer': {
          target: 'https://api.deezer.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/deezer/, ''),
        },
      },
    },
  }
})
