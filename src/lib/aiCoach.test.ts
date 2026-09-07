import { describe, expect, it } from 'vitest'
import { getAiFunctionErrorMessage, getReadableAiMessage } from './aiCoach'

describe('AI云函数错误提示', () => {
  it('把旧JWT网关错误翻译成可执行提示', async () => {
    const error = {
      message: '{}',
      context: {
        status: 401,
        clone: () => ({
          status: 401,
          json: async () => ({ message: 'Invalid JWT' })
        })
      }
    }
    await expect(getAiFunctionErrorMessage(error)).resolves.toContain('登录令牌')
  })

  it('不把空对象直接显示给用户', async () => {
    await expect(getAiFunctionErrorMessage({ message: '{}' })).resolves.toBe('AI教练后端连接失败，请重新读取状态后再试。')
  })

  it('后端业务错误为空对象时改为可读提示', () => {
    expect(getReadableAiMessage('{}', '连接失败，请重试。')).toBe('连接失败，请重试。')
    expect(getReadableAiMessage({ message: '模型不存在' }, '连接失败，请重试。')).toBe('模型不存在')
  })
})
