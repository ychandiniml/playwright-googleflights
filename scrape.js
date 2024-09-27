const fs = require('fs');
const { chromium } = require('playwright');

// Set the number of cities to process per batch
const BATCH_SIZE = 2;  

// Load progress from checkpoint file
function loadCheckpoint() {
  if (fs.existsSync('checkpoint.json')) {
    const checkpointData = JSON.parse(fs.readFileSync('checkpoint.json', 'utf8'));
    console.log("Checkpoint: Loaded progress from checkpoint file:", checkpointData);
    return checkpointData;
  } else {
    console.log("Checkpoint: No existing checkpoint found, starting fresh.");
    return [];
  }
}

// Save progress to checkpoint file
function saveCheckpoint(processedCities) {
  fs.writeFileSync('checkpoint.json', JSON.stringify(processedCities, null, 2));
  console.log("Checkpoint: Progress saved to checkpoint.json.");
}

// Append data to a JSONL file (each city's data is appended as a new line)
function appendToJSONL(filename, data) {
  const jsonlData = JSON.stringify(data) + '\n';  
  fs.appendFileSync(filename, jsonlData);  
  console.log(`Checkpoint: Appended data to ${filename}`);
}

async function scrapeAirports() {
  console.log("Checkpoint: Starting the browser...");
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  console.log("Checkpoint: Navigating to Google Flights...");
  await page.goto('https://flights.google.com/');

  const uniqueCities = [
    { id: "ccoin5jckbjdd1hmcm91svld", name: "BRUSSELS", iata_code: "BRU", state_code: "", region_code: "Europe" },
    { id: "neyj1lu67n55rzt05k0leo45", name: "AACHEN", iata_code: "AAH", state_code: "", region_code: "Europe" },
    { id: "pblbcxf3ukiehf1m0r3cnvmm", name: "A CORUNA", iata_code: "LCG", state_code: "", region_code: "Europe" },
    { id: "nfyy93dsonhynj9j021nr1vy", name: "AALBOR", iata_code: "AAL", state_code: "", region_code: "Europe" }
  ];

  // Load previously processed cities from checkpoint
  let processedCities = loadCheckpoint();

  while (true) {
    // Get the unprocessed cities
    const unprocessedCities = uniqueCities.filter(city => !processedCities.includes(city.name));

    // If no cities are left to process, exit
    if (unprocessedCities.length === 0) {
      console.log("Checkpoint: All cities have been processed.");
      break;
    }

    // Define the filename for the JSONL file
    const filename = 'output.jsonl';

    // Process cities in batches
    const citiesToProcess = unprocessedCities.slice(0, BATCH_SIZE);  // Take a slice of cities for this batch

    for (const city of citiesToProcess) {
      const { id, name, iata_code, state_code, region_code } = city;

      if (!name) {
        console.error('Checkpoint: City name is undefined for ID:', id);
        continue;
      }

      console.log(`Checkpoint: Searching for flights from city: ${name}...`);

      // Clear the field and enter the city name
      console.log("Checkpoint: Clearing input field and entering city name:", name);
      await page.fill(".II2One.j0Ppje.zmMKJ.LbIaRd", ''); 
      await page.fill(".II2One.j0Ppje.zmMKJ.LbIaRd", name); 
      await page.waitForTimeout(3000);  

      console.log(`Checkpoint: Successfully entered city: ${name}. Now fetching airport data...`);

      // Extract nearby airports
      const airports = await page.$$eval('.n4HaVc.Elfbjb.VgAC5d', (cards) => {
        return cards.map(card => {
          const name = card.querySelector('.zsRT0d')?.textContent.trim();
          const iataCode = card.querySelector('.P1pPOe')?.textContent.trim();
          const distance = card.querySelector('.t7Thuc')?.textContent.trim();
          return { name, iataCode, distance };
        }).filter(airport => airport.name && airport.iataCode && airport.distance);
      });

      // Checkpoint: Verify the extracted airport data
      console.log(`Checkpoint: Extracted ${airports.length} airports for ${name}.`);

      if (airports.length === 0) {
        console.warn(`Checkpoint: No airports found for ${name}. Moving to the next city.`);
        continue;
      }

      const cityName = await page.$eval('.zsRT0d', el => el.textContent.trim());
      const description = await page.$eval('.t7Thuc', el => el.textContent.trim());

      console.log(`Checkpoint: Extracted city name and description: ${cityName}, ${description}`);

      const data = {
        "id": id,
        "name": name, 
        "iata_code": iata_code,
        "state_code": state_code,
        "region_code": region_code,
        "data": [{
          "name": cityName,
          "description": description,
          "airports": airports
        }]
      };

      await page.keyboard.press('Enter'); 
      await page.waitForTimeout(1000);

      // Append the individual city data to the JSONL file
      appendToJSONL(filename, data);

      console.log(`Checkpoint: Added ${cityName} to results. Moving to the next city...`);

      // Save progress after each city is processed
      processedCities.push(name);
      saveCheckpoint(processedCities);
    }
  }

  console.log("Checkpoint: Closing the browser...");
  await browser.close();

  console.log("Checkpoint: All batches processed.");
}

// Start the scraping process with error handling
scrapeAirports().catch((error) => {
  console.error("Error encountered during scraping:", error);
});
