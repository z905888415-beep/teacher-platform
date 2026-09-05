/** 本地访问密码：仅用于应用访问保护，不作为强加密（开发文档 11.3） */

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`tw::${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash
}
