import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join, basename } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '').replace(/\//g, '\\')
const dist = join(root, 'dist')
const assets = join(dist, 'assets')
const release = join(root, 'release')
const htmlPath = join(dist, 'index.html')
const names = await readdir(assets)
const cssName = names.find((name) => name.endsWith('.css'))
const jsName = names.filter((name) => name.endsWith('.js')).sort((a, b) => b.length - a.length).find((name) => name.startsWith('index-'))

if (!cssName || !jsName) throw new Error('没有找到生产构建的 CSS 或主 JavaScript 文件。')

let html = await readFile(htmlPath, 'utf8')
const css = await readFile(join(assets, cssName), 'utf8')
const js = (await readFile(join(assets, jsName), 'utf8')).replaceAll('</script', '<\\/script')

html = html
  .replace(/<link[^>]+rel="icon"[^>]*>\s*/gi, '')
  .replace(/<link[^>]+rel="manifest"[^>]*>\s*/gi, '')
  .replace(/<script[^>]+vite-plugin-pwa:register-sw[^>]*>\s*<\/script>\s*/gi, '')
  .replace(/<link[^>]+rel="stylesheet"[^>]*>\s*/i, () => `<style>${css}</style>`)
  .replace(/<script type="module"[^>]+src="[^"]+"[^>]*><\/script>/i, () => `<script type="module">${js}</script>`)

const moduleScriptCount = html.match(/<script type="module">/gi)?.length ?? 0
const scriptCloseCount = html.match(/<\/script>/gi)?.length ?? 0
const hasExternalScript = /<script\b[^>]*\bsrc=/i.test(html)

if (moduleScriptCount !== 1 || scriptCloseCount !== 1 || hasExternalScript) {
  throw new Error('单文件校验失败：脚本标签数量异常或仍有外链脚本。')
}

await mkdir(release, { recursive: true })
await writeFile(join(dist, 'single.html'), html, 'utf8')
await writeFile(htmlPath, html, 'utf8')
await writeFile(join(release, 'nutri-agent-single.html'), html, 'utf8')
console.log(`已生成 ${basename(htmlPath)}、single.html 和正式发布文件：${html.length} 字符。`)
