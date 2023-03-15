import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node'
import { Memory } from 'lowdb'
import Logger from 'js-logger';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { fileURLToPath } from 'url';

dotenv.config();

(async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = join(__dirname, '../../client/data/db.json')
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));
  const urls = config.urls;
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const prices = {};
  const timestamp = new Date().valueOf();
  const db = new Low(
    process.env.NODE_ENV === 'development'
    ? new Memory()
    : new JSONFile(file)
  );

  Logger.useDefaults();

  if (config.logLevel) {
    Logger.setLevel(config.logLevel);
  }

  await db.read();

  db.data = db.data || { prices: [] };

  Logger.info(`${urls.length} urls found. Starting parse processs...`);

  for(let i = 0; i < urls.length; i++) {
    Logger.info(`Parsing ${i+1} of ${urls.length}...`);

    const url = urls[i];
    const product = await parseContinente(page, db, url);
    const priceInfo = {
      price: parseFloat(product.price),
      name: product.name,
      timestamp
    };

    if (prices[url.source]) {
      prices[url.source].push(priceInfo);
    } else {
      prices[url.source] = [priceInfo];
    }
  }

  await browser.close();

  db.data.prices.push(prices);

  await db.write();

  Logger.info("Parsing process ended.");
})();

async function parseContinente(page, url) {
  await page.goto(url.url, {waitUntil: 'load', timeout: 0, waitUntil: "networkidle0"});

  const price = await page.$eval('.prices-wrapper span.value ', (el) => {
    return el.getAttribute('content');
  });

  const productName = await page.$eval('.product-name', el => el.textContent);

  return { price, name: productName };
}

