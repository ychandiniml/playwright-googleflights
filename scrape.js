const fs = require('fs');
const { chromium } = require('playwright');

// Load city data from JSON
async function loadCities() {
  const cities = JSON.parse(fs.readFileSync('core_city.json', 'utf8'));
  
  console.log('Loaded cities:', cities);

  const uniqueCities = cities.filter(city => city.name)
    .filter((city, index, self) => 
      index === self.findIndex(c => c.name === city.name))

  console.log('Unique cities:', uniqueCities);
  
  return uniqueCities;
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

  if (uniqueCities.length === 0) {
    console.error('No unique cities found. Exiting...');
    return;
  }

  const results = [];

  for (let i = startIndex; i < uniqueCities.length; i++) {
    const city = uniqueCities[i];
    const id = city.id; 
    const name = city.name;  
    const iata_code = city.iata_code;  
    const state_code = city.state_code;  
    const region_code = city.region_code; 

    if (!name) {
      console.error('City name is undefined:', name);
      continue;
    }

    console.log(`Searching for flights from city: ${name}`);

    await page.fill(".II2One.j0Ppje.zmMKJ.LbIaRd", ''); 
    await page.fill(".II2One.j0Ppje.zmMKJ.LbIaRd", name); 
    await page.waitForTimeout(3000);  

    console.log("Entered ", name);
 
    const airports = await page.$$eval('.n4HaVc.Elfbjb.VgAC5d', (cards) => {
      return cards.map(card => {
        const name = card.querySelector('.zsRT0d')?.textContent.trim();
        const iataCode = card.querySelector('.P1pPOe')?.textContent.trim();
        const distanceText = card.querySelector('.t7Thuc')?.textContent.trim();
        const distance = distanceText ? parseInt(distanceText.replace(" km", "")) : null; // Remove ' km' and convert to number
        return {name, iataCode, distance };
      }).filter(airport => airport.name && airport.iataCode && airport.distance);
    });
    
    const cityName = await page.$eval('.zsRT0d', el => el.textContent.trim());
    const description = await page.$eval('.t7Thuc', el => el.textContent.trim());
    console.log({ cityName, description });
    
    const data = {
      "name":cityName, 
      "description":description,
      "airports": airports
    }
    console.log("data" , data);
 
    await page.keyboard.press('Enter');  

    results.push({
      id,
      name,
      iata_code,
      state_code,
      region_code, 
      data
    });

    console.log(name, " airports: ", airports);
    fs.writeFileSync(checkpointFile, JSON.stringify({ lastProcessedIndex: i + 1 }, null, 2));

  }

  await browser.close();

  fs.writeFileSync('output.json', JSON.stringify(results, null, 2));
  console.log('Scraping complete, data saved to output.json');
}

scrapeAirports().catch(console.error);