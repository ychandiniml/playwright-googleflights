const fs = require('fs');
const { chromium } = require('playwright');

// Load city data from JSON
async function loadCities() {
  const cities = JSON.parse(fs.readFileSync('core_city.json', 'utf8'));
  return cities;
}

async function scrapeAirports() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://flights.google.com/');

  const uniqueCities = await loadCities(); 

  // Checkpoint file to resume from
  const checkpointFile = 'checkpoint.json';
  let startIndex = 0;

  // Load checkpoint if it exists
  if (fs.existsSync(checkpointFile)) {
    const checkpointData = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
    startIndex = checkpointData.lastProcessedIndex || 0;
    console.log(`Resuming from index: ${startIndex}`);
  }

  const results = [];

  for (let i = startIndex; i < uniqueCities.length; i++) {
    const city = uniqueCities[i];
    const { id, name, iata_code, state_code, region_code } = city;

    if (!name) {
      console.error('City name is undefined:', name);
      continue;
    }

    console.log(`Searching for flights from city: ${name}`);

    try {
      await page.fill(".II2One.j0Ppje.zmMKJ.LbIaRd", '');
      await page.fill(".II2One.j0Ppje.zmMKJ.LbIaRd", name);
      await page.waitForTimeout(3000);

      const locationOptions = await page.$$('.n4HaVc.sMVRZe.pIWVuc');
      console.log("locationOptions", locationOptions);


      for (let location of locationOptions) {
        const locationName = await location.$eval('.zsRT0d', el => el.textContent.trim());
        const locationDescription = await location.$eval('.t7Thuc', el => el.textContent.trim());

        console.log(`Found location: ${locationName} - ${locationDescription}`);

        // Click the button to expand nearby airports for this location
        const expandButton = await location.$('.VfPpkd-Bz112c-LgbsSe');
        if (expandButton) {
          await expandButton.click();
          await page.waitForTimeout(3000); 
        }

        // Extract nearby airports for this location
        const airports = await page.$$eval('.n4HaVc.Elfbjb.VgAC5d', (cards) => {
          return cards.map(card => {
            const airportName = card.querySelector('.zsRT0d')?.textContent.trim();
            const iataCode = card.querySelector('.P1pPOe')?.textContent.trim();
            const distanceText = card.querySelector('.t7Thuc')?.textContent.trim();
            const distance = distanceText ? parseInt(distanceText.replace(" km", "")) : null; // Remove ' km' and convert to number
            return { name: airportName, iataCode, distance }; // Return airport details
          }).filter(airport => airport.name && airport.iataCode && airport.distance);
        });

        if (airports.length === 0) {
          console.error(`No airports found for ${locationName}.`);
          continue; 
        }

        // Prepare data in the correct structure for each location
        const locationData = {
          name: locationName,
          description: locationDescription,
          airports: airports
        };

        console.log(`${locationName} airports:`, airports);

        results.push({
          id,
          name: locationName,  
          iata_code,
          state_code,
          region_code,
          data: [locationData]
        });
        
        // Collapse the expanded location
        await page.keyboard.press('Escape'); 
        await page.waitForTimeout(1000);
      }
      
      // Save checkpoint after processing each city
      fs.writeFileSync(checkpointFile, JSON.stringify({ lastProcessedIndex: i + 1 }, null, 2));

      
    } catch (error) {
      console.error(`Error processing city ${name}:`, error);
    }
  }

  await browser.close();

  fs.writeFileSync('output.json', JSON.stringify(results, null, 2));
  console.log('Scraping complete, data saved to output.json');
}

scrapeAirports().catch(console.error);
