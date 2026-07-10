import * as jose from 'jose'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || '')

export async function verifyToken(token: string): Promise<string | null> {
  if (!secret.length) {
    console.error('AUTH_SECRET is not set')
    return null
  }
  try {
    const { payload } = await jose.jwtVerify(token, secret)
    const sub = payload.sub || payload.id
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}
