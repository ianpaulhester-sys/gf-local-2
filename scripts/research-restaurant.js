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
let nextId = Math.max(...restaurants.map(r => r.id)) + 1;

// Get existing restaurant names to avoid duplicates
const existingNames = restaurants.map(r => r.name.toLowerCase());

async function researchRestaurants() {
  console.log(`Researching: ${requestType} - ${requestValue}`);
  if (requestDetails) {
    console.log(`Details: ${requestDetails}`);
  }

  const prompt = `You are helping find gluten-free friendly restaurants in North Carolina.

A user has requested: "${requestValue}"
Request type: ${requestType}
Additional details: ${requestDetails || 'None'}

Please research and find 10 real restaurants that match this request:
- AT LEAST 5 restaurants MUST be in the exact city/location mentioned in the request
- The remaining restaurants (up to 5) can be in nearby cities in the NC Triangle area (Raleigh, Cary, Durham, Chapel Hill, Morrisville, Apex, Holly Springs, Wake Forest, etc.)

Each restaurant must:
1. Be a real, currently operating restaurant
2. Have genuine gluten-free options
3. Not be in this list of restaurants we already have: ${existingNames.slice(0, 50).join(', ')}

Respond with ONLY a JSON array (no markdown, no explanation) containing exactly 10 restaurant objects:
[
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
  },
  ...9 more restaurants
]

Important:
- Return EXACTLY 10 restaurants
- At least 5 must be in the exact requested location
- Use realistic coordinates for the NC area (lat ~35.7-36.1, lng ~-78.5 to -79.0)
- Include 3-5 actual GF menu items with realistic prices for each
- Be accurate about whether they're on DoorDash
- Each restaurant must be unique (no duplicates)`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text.trim();
    console.log('API Response received, parsing...');

    // Parse the JSON response
    const newRestaurants = JSON.parse(content);

    if (!Array.isArray(newRestaurants)) {
      console.log('Response was not an array, skipping.');
      process.exit(0);
    }

    let addedCount = 0;

    for (const restaurantData of newRestaurants) {
      // Skip if missing required fields
      if (!restaurantData.name || !restaurantData.city) {
        console.log('Skipping restaurant with missing data');
        continue;
      }

      // Check for duplicates
      if (existingNames.includes(restaurantData.name.toLowerCase())) {
        console.log(`Restaurant "${restaurantData.name}" already exists, skipping.`);
        continue;
      }

      // Add the ID and append to the list
      const newRestaurant = {
        id: nextId++,
        ...restaurantData
      };

      restaurants.push(newRestaurant);
      existingNames.push(restaurantData.name.toLowerCase());
      addedCount++;
      console.log(`Added: ${newRestaurant.name} (${newRestaurant.city})`);
    }

    // Write back to file
    fs.writeFileSync(restaurantsPath, JSON.stringify(restaurants, null, 2));

    console.log(`\nSuccessfully added ${addedCount} restaurants`);
    console.log(`Total restaurants: ${restaurants.length}`);

  } catch (error) {
    console.error('Error researching restaurants:', error.message);
    process.exit(1);
  }
}

researchRestaurants();
