import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await hash('demo123456', 12)

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: { password },
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password,
    },
  })

  console.log('Seeded user:', user.email, '(password: demo123456)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
