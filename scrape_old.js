const fs = require('fs');
const csv = require('csv-parser');
const { chromium } = require('playwright');

// Load city data from CSV
async function loadCities() {
  const cities = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream('core_airport.csv')
      .pipe(csv())
      .on('data', (data) => {
        console.log('Row from CSV:', data);
        cities.push(data);
      })
      .on('end', () => {
        console.log('All cities loaded:', cities);
        resolve(cities);
      })
      .on('error', reject);
  });
}

// Main function to scrape Google Flights
async function scrapeAirports() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://flights.google.com/');

  // const cities = await loadCities();
  const cities = [{
    "city_name": "Bengaluru",
    "iata_code": "BLR"
  }]
  console.log("cities", cities);
  const results = [];

  for (const city of cities) {
    const cityName = city.city_name;
    if (!cityName) {
      console.error('City name is undefined for row:', city);
      continue;
    }

    console.log(`Searching for flights from city: ${cityName}`);

    await page.fill('input[placeholder="Where to?"]', cityName);
    await page.waitForTimeout(2000);

    console.log("entered ", cityName);

    const airports = await page.$$eval('.n4HaVc.Elfbjb.VgAC5d', (cards) => {
      console.log("cards", cards);
      return cards.map(card => {
        const airportCode = card.querySelector('.P1pPOe')?.textContent.trim();
        const airportName = card.querySelector('.zsRT0d')?.textContent.trim();
        const distance = card.querySelector('.t7Thuc');
        return { airportCode, airportName, distance };
      }).filter(airport => airport.airportCode && airport.airportName && airport.distance);
    });

    console.log(cityName, " airports: ", airports);
    results.push(...airports);
  }
  // TODO: clear the input and re-enter next cityname

  await browser.close();

  const output = results.map(r => `${r.airportCode}, ${r.airportName}, ${r.distance}`).join('\n');
  fs.writeFileSync('output.csv', output);
  console.log('Scraping complete, data saved to output.csv');
}

scrapeAirports().catch(console.error);

