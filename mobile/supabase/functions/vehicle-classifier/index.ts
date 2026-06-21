export default async function handler(req: Request): Promise<Response> {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { image } = await req.json();
    
    const brands = ["Toyota", "Nissan", "Honda", "Mazda", "Volkswagen", "Ford", "Hyundai", "Kia", "Audi", "BMW"];
    const models = ["Corolla", "Versa", "Civic", "Mazda3", "Jetta", "Focus", "Tucson", "Sportage", "A4", "Serie 3"];
    
    const idx = Math.floor(Math.random() * brands.length);

    return new Response(
      JSON.stringify({
        brand: brands[idx],
        model: models[idx],
        car_type: "Sedan",
        doors: 4,
        seats: 5,
        displacement: 1.8,
        max_speed: 180,
        confidence: 0.85,
        top3: [
          { brand: brands[idx], model: models[idx], confidence: 0.85 },
          { brand: brands[(idx+1)%10], model: models[(idx+1)%10], confidence: 0.10 },
          { brand: brands[(idx+2)%10], model: models[(idx+2)%10], confidence: 0.05 }
        ],
        processingTime: 50
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
}
