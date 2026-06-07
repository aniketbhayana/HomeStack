import { chromium } from 'playwright'

export async function scrapeMagicBricksProject(url: string) {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    const title = await page.title()

    console.log('[MB PROJECT]', title)

    return []
  } finally {
    await browser.close()
  }
}
async function test() {
  await scrapeMagicBricksProject(
    'https://www.magicbricks.com/project-sobha-carnation-for-sale-in-bangalore-pppfs'
  )
}

test()