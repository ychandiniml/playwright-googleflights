const fs = require('fs');
const csv = require('csv-parser');
const { chromium } = require('playwright');

// Load city data from CSV
async function loadCities() {
  const cities = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream('core_airport.csv')
      .pipe(csv())
      .on('data', (data) => cities.push(data))
      .on('end', () => resolve(cities))
      .on('error', reject);
  });
}

// Main function to scrape Google Flights
async function scrapeAirports() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://flights.google.com/');

  const cities = await loadCities();
  const results = [];

  for (const city of cities) {
    const cityName = city.City; // Assuming CSV has 'City' field
    await page.fill('input[placeholder="Where to?"]', cityName);
    await page.waitForTimeout(2000); // Wait for results to load

    const airports = await page.$$eval('div.flight-card', (cards) => {
      return cards.map(card => {
        const cityCode = 'NYC'; // You may need to extract the actual city IATA code
        const airportCode = card.querySelector('.airport-code').textContent.trim();
        const airportName = card.querySelector('.airport-name').textContent.trim();
        const distance = card.querySelector('.distance').textContent.trim();
        return { cityCode, airportCode, airportName, distance };
      });
    });

    results.push(...airports);
  }

  await browser.close();

  // Write the results to CSV
  const output = results.map(r => `${r.cityCode}, ${r.airportCode}, ${r.airportName}, ${r.distance}`).join('\n');
  fs.writeFileSync('output.csv', output);
  console.log('Scraping complete, data saved to output.csv');
}

scrapeAirports().catch(console.error);
