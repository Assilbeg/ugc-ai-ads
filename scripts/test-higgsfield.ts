// Script de test pour générer un acteur via Higgsfield Soul
// Usage: npx tsx scripts/test-higgsfield.ts

// IMPORTANT: dotenv MUST load before any other imports
import { config } from 'dotenv'
const result = config({ path: '.env.local' })
if (result.error) {
  console.error('Failed to load .env.local:', result.error)
  process.exit(1)
}

// Now we can import modules that use env vars
async function main() {
  // Dynamic import AFTER env is loaded
  const { generateSoulImage, buildActorPrompt } = await import('../lib/api/higgsfield')
  
  const actor = {
    name: "Emma",
    gender: "female" as const,
    age_range: "24-28",
    ethnicity: "European",
    hair: "long blonde straight",
    distinctive_features: "bright blue eyes, natural makeup, warm smile",
    style: "casual trendy"
  }

  const prompt = buildActorPrompt(actor)
  console.log("📝 Prompt:", prompt)
  console.log("\n🎨 Generating via Higgsfield Soul...")

  try {
    const res = await generateSoulImage(prompt, '9:16')
    console.log("\n✅ SUCCESS!")
    console.log("🖼️  Image URL:", res.image_url)
    console.log("🔑 Request ID:", res.request_id)
  } catch (error) {
    console.error("\n❌ ERROR:", error)
    process.exit(1)
  }
}

main()

