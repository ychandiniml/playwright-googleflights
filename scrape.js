const fs = require('fs');
const { chromium } = require('playwright');

// Load city data from JSON
async function loadCities() {
  const cities = JSON.parse(fs.readFileSync('core_city.json', 'utf8'));
  
  console.log('Loaded cities:', cities);

  // const uniqueCities = [...new Set(cities.map(city => city.name))];
  const uniqueCities = cities.filter(city => city.name)
  .filter((city, index, self) => 
    index === self.findIndex(c => c.name === city.name));


  console.log('Unique cities:', uniqueCities);
  
  return uniqueCities;
}

async function scrapeAirports() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://flights.google.com/');

  // const uniqueCities = await loadCities();  
  const uniqueCities = [
    {
      id: "ccoin5jckbjdd1hmcm91svld",
      name: "BRUSSELS",
      iata_code: "BRU",
      state_code:"",
      region_code: "Europe"
    },
    {
      id: "neyj1lu67n55rzt05k0leo45",
      name: "AACHEN",
      iata_code: "AAH",
      state_code:"",
      region_code: "Europe"
    }
  ];

  
  if (uniqueCities.length === 0) {
    console.error('No unique cities found. Exiting...');
    return;
  }

  const results = [];

  for (const city of uniqueCities) {
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
        const distance = card.querySelector('.t7Thuc')?.textContent.trim();
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
  }

  await browser.close();

  fs.writeFileSync('output.json', JSON.stringify(results, null, 2));
  console.log('Scraping complete, data saved to output.json');
}

scrapeAirports().catch(console.error);


