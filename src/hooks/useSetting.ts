import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

/** 读取一个设置项（字符串）；settings 表为 key-value */
export function useSetting(key: string, fallback: string): string {
  const value = useLiveQuery(() => db.settings.get(key), [key])
  return value?.value ?? fallback
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await db.settings.get(key)
  return row?.value ?? fallback
}
