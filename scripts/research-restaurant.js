import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();

const requestType = process.env.REQUEST_TYPE || 'cuisine';
const requestValue = process.env.REQUEST_VALUE || '';
const requestDetails = process.env.REQUEST_DETAILS || '';

if (!requestValue) {
  console.log('No request value provided, skipping.');
  process.exit(0);
}

const restaurantsPath = path.join(process.cwd(), 'src', 'data', 'restaurants.json');
const restaurants = JSON.parse(fs.readFileSync(restaurantsPath, 'utf-8'));

// Get the next ID
const nextId = Math.max(...restaurants.map(r => r.id)) + 1;

// Get existing restaurant names to avoid duplicates
const existingNames = restaurants.map(r => r.name.toLowerCase());

async function researchRestaurant() {
  console.log(`Researching: ${requestType} - ${requestValue}`);
  if (requestDetails) {
    console.log(`Details: ${requestDetails}`);
  }

  const prompt = `You are helping find gluten-free friendly restaurants in the Raleigh/Cary/Durham, NC area.

A user has requested: "${requestValue}"
Request type: ${requestType}
Additional details: ${requestDetails || 'None'}

Please research and find ONE real restaurant that matches this request. The restaurant must:
1. Be a real, currently operating restaurant
2. Have genuine gluten-free options
3. Be in the Raleigh, Cary, Durham, or nearby NC area

Already in our database (do NOT suggest these): ${existingNames.slice(0, 30).join(', ')}

Respond with ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "name": "Restaurant Name",
  "cuisine": "Cuisine Type (e.g., Italian, Thai, American)",
  "address": "Full street address with city, state, zip",
  "city": "City name only (Raleigh, Cary, Durham, etc.)",
  "lat": 35.xxxx,
  "lng": -78.xxxx,
  "gfOptions": "Brief GF description (e.g., 'GF Menu Available', 'Dedicated GF Kitchen', '100% GF')",
  "menuItems": [
    {"name": "GF Menu Item 1", "price": 12.99},
    {"name": "GF Menu Item 2", "price": 14.99},
    {"name": "GF Menu Item 3", "price": 10.99}
  ],
  "doordash": true,
  "notes": "Brief notes about GF safety, staff knowledge, or special accommodations",
  "website": "https://restaurant-website.com",
  "doordashUrl": "https://www.doordash.com/store/..." or null if not on DoorDash
}

Important:
- Use realistic coordinates for the NC Triangle area (lat ~35.7-36.1, lng ~-78.5 to -79.0)
- Include 3-5 actual GF menu items with realistic prices
- Be accurate about whether they're on DoorDash
- If you cannot find a suitable real restaurant, respond with: {"error": "No suitable restaurant found"}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text.trim();
    console.log('API Response:', content);

    // Parse the JSON response
    const restaurantData = JSON.parse(content);

    if (restaurantData.error) {
      console.log('Could not find a suitable restaurant:', restaurantData.error);
      process.exit(0);
    }

    // Check for duplicates
    if (existingNames.includes(restaurantData.name.toLowerCase())) {
      console.log(`Restaurant "${restaurantData.name}" already exists, skipping.`);
      process.exit(0);
    }

    // Add the ID and append to the list
    const newRestaurant = {
      id: nextId,
      ...restaurantData
    };

    restaurants.push(newRestaurant);

    // Write back to file
    fs.writeFileSync(restaurantsPath, JSON.stringify(restaurants, null, 2));

    console.log(`Successfully added: ${newRestaurant.name}`);
    console.log(`Total restaurants: ${restaurants.length}`);

  } catch (error) {
    console.error('Error researching restaurant:', error.message);
    process.exit(1);
  }
}

researchRestaurant();
