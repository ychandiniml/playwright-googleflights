const fs = require('fs');
const { chromium } = require('playwright');

// Load city data from JSON
async function loadCities() {
  const cities = JSON.parse(fs.readFileSync('core_city.json', 'utf8'));
  
  // Log all loaded cities for debugging
  console.log('Loaded cities:', cities);

  // Ensure city.name exists and filter only those with a valid name
  const validCities = cities.filter(city => city.name && city.name.trim() !== '');

  // Create a set of unique city names
  const uniqueCities = [...new Set(validCities.map(city => city.name))];

  // Log unique city names for debugging
  console.log('Unique cities:', uniqueCities);
  
  return uniqueCities;
}

// Main function to scrape Google Flights
async function scrapeAirports() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://flights.google.com/');

  const uniqueCities = await loadCities();  // Load unique city names
  //  const uniqueCities = [
  //   {
  //     name: "Brussels",
  //     iata_code: "BRU"
  //   },
  //   {
  //     name: "New York",
  //     iata_code: "NYK"
  //   }
  // ];
  
  
  if (uniqueCities.length === 0) {
    console.error('No unique cities found. Exiting...');
    return;
  }

  const results = [];

  for (const cityName of uniqueCities) {
    // const cityName = city.name;  // Access the city name as a string

    if (!cityName) {
      console.error('City name is undefined:', cityName);
      continue;
    }

    console.log(`Searching for flights from city: ${cityName}`);

    // Clear the input field and enter the unique city name in the origin field
    await page.fill(".II2One.j0Ppje.zmMKJ.LbIaRd", ''); 
    await page.fill(".II2One.j0Ppje.zmMKJ.LbIaRd", cityName); 
    await page.waitForTimeout(3000);  // Wait for results to load

    console.log("Entered ", cityName);

    // Scrape the airport data
    const airports = await page.$$eval('.n4HaVc.Elfbjb.VgAC5d', (cards) => {
      return cards.map(card => {
        const airportCode = card.querySelector('.P1pPOe')?.textContent.trim();
        const airportName = card.querySelector('.zsRT0d')?.textContent.trim();
        const distance = card.querySelector('.t7Thuc')?.textContent.trim();
        return { airportCode, airportName, distance };
      }).filter(airport => airport.airportCode && airport.airportName && airport.distance);
    });

    await page.keyboard.press('Enter');  // Confirm search

    // Add city details to each airport entry
    airports.forEach(airport => {
      airport.cityName = cityName;
    });

    console.log(cityName, " airports: ", airports);
    results.push(...airports);
  }

  await browser.close();

  // Save the results to a structured JSON format
  fs.writeFileSync('output.json', JSON.stringify(results, null, 2));
  console.log('Scraping complete, data saved to output.json');
}

scrapeAirports().catch(console.error);
