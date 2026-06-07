import 'dotenv/config'
import { getJson } from 'serpapi'

async function test() {
  const data = await getJson({
    engine: 'google_maps_reviews',
    place_id: 'ChIJ_f3oPpwTrjsRX9blcYI7Chw', // Sobha Carnation
    api_key: process.env.SERPAPI_KEY,
  })

  console.log(JSON.stringify(data, null, 2))
}

test().catch(console.error)