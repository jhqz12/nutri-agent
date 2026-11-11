/**
 * 空腹状态照片的本地存储。
 *
 * 为什么不塞进 AppState / localStorage：
 * 1) localStorage 只有约 5MB，几十张照片就会写满；
 * 2) AppState 每次改动都会整体 JSON 序列化写一遍，带 base64 图片会明显卡顿；
 * 3) 开启云同步时整个 state 会上传，照片会把同步体撑爆。
 * 因此状态里只存 photoId，图片本体放 IndexedDB。
 */

const DATABASE_NAME = 'hengdong-media'
const STORE_NAME = 'body-photos'
const DATABASE_VERSION = 1
/** 压到 1280px 长边、JPEG，单张通常 150～300KB，手机上翻看也够清晰。 */
const MAX_EDGE = 1280

interface PhotoRecord {
  id: string
  dataUrl: string
  savedAt: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持本机图片存储'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('打开图片库失败'))
  })
}

export async function savePhoto(id: string, dataUrl: string): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const record: PhotoRecord = { id, dataUrl, savedAt: new Date().toISOString() }
    store.put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('保存图片失败'))
  })
  database.close()
}

export async function loadPhoto(id: string): Promise<string | null> {
  const database = await openDatabase()
  const dataUrl = await new Promise<string | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve((request.result as PhotoRecord | undefined)?.dataUrl ?? null)
    request.onerror = () => reject(request.error ?? new Error('读取图片失败'))
  })
  database.close()
  return dataUrl
}

export async function deletePhoto(id: string): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('删除图片失败'))
  })
  database.close()
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('读取图片失败'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解析失败'))
    image.src = source
  })
}

/**
 * 把用户选的照片压到合理体积。压不动时返回原图，不会丢内容。
 * HEIC 这类浏览器解不了的格式会抛错，由界面提示用户换格式。
 */
export async function compressImage(file: File, maxEdge = MAX_EDGE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  const original = await readAsDataUrl(file)
  if (file.type === 'image/gif') return original

  const image = await loadImage(original)
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return original
  context.drawImage(image, 0, 0, width, height)

  for (const quality of [0.82, 0.7, 0.6]) {
    const result = canvas.toDataURL('image/jpeg', quality)
    // base64 长度约等于字节数的 1.37 倍，这里按 500KB 原图控制
    if (result.length < 700_000) return result
  }
  return canvas.toDataURL('image/jpeg', 0.55)
}
