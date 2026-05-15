async function getProperties() {
  const res = await fetch('http://localhost:3001/v1/properties', {
    cache: 'no-store' // always fetch fresh during development
  })
  return res.json()
}

export default async function Home() {
  const data = await getProperties()

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">HomeStack</h1>
      <p className="text-gray-500 mb-8">Property Decision Engine</p>

      <div className="grid gap-4 max-w-2xl">
        {data.results.map((property: any) => (
          <div key={property.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{property.title}</h2>
                <p className="text-gray-500 text-sm mt-1">{property.locality}, {property.city}</p>
              </div>
              <span className="bg-green-100 text-green-700 font-bold text-sm px-3 py-1">
                {property.fitScore} fit
              </span>
            </div>

            <div className="flex gap-6 mt-4 text-sm text-gray-600">
              <span>{property.bhk} BHK</span>
              <span>{property.areaSqft} sqft</span>
              <span>{property.commuteMinutes} min commute</span>
              <span>${(property.priceTotal / 100000).toFixed(0)}L</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}