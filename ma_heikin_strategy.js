/*
    Pretty much exactly the same as `example_live_strategy_ma_cross.js` except uses historical 
    offline data from a file instead of pulling directly from the exchange.
    Oh and uses daily bars with an MA30 instead.

*/

// const LiveFeed      = require('./src/feed/Live');
const DiskFeed = require("./src/feed/Offline");
const LiveFeed = require("./src/feed/Live");

const Backtester = require("./src/Backtester");
const fs = require("fs");

const HMA = require("./indicators/HMA");
const HeikinAsh = require("./indicators/HeikinAsh");
const Indicators = require("technicalindicators");

const MAX_HISTORICAL_BARS = 1000;

// Settings for your backtest/trading
const RESOLUTION = "1h"; // '1m', '5m', '1h', '1d'
const RUN_LIVE = false; // enable live trading or not
const HISTORICAL_BARS = 1000; // how many bars to download before running live/backtest (max 1000)
const atrMultiple = 1;
const stopConstant = 0.01;
const stops = false;
const takeProfits = false;
// Daily bars
const filename = __dirname + "/data/XBTUSD-1d.json";

if (!fs.existsSync(filename)) {
  console.log(
    `\nERROR: File missing ${filename}.\nGo to ./data/ folder and run: node scrape 1d 1000 XBTUSD\n`
  );
  process.exit(1);
}

// Data

const feed = new DiskFeed(filename);

// 'Backtest' the incoming data, can be used for Live or Offline bars
const larp = new Backtester();

larp.fees.on = true;
larp.fees.mode = "makertaker";

let series = [];
let seriesClose = [];

// Helper to get the `index`th element of an array counting backwards from the final element
// e.g. prev( arr, 0 ) gets the last element of arr[] instead of the first
const prev = (array, index) =>
  array.length ? array[array.length - 1 - index] : null;

const hma = new HMA(55);
// best gains
// const hma = new HMA(50);
const heikin = new HeikinAsh(17);
const ATR = new Indicators["ATR"]({ period: 7, high: [], low: [], close: [] });

// This function called everytime a new bar closes
// including historical data. check the `.live` property of `bar` to see if old bar or new
// `bar`:       the current bar which just closed
// `series`:    list of all bars we've received, including the most recent one
function onclose(bar, series) {
  // Trade Setup (for longs):
  // Stop: Use a recent low (set a minimum stop range though)
  // Entry: 1min bar close
  // Target: take ATR(24) of hourly bars (last day of range activity)
  // target = entry + HOURLY_ATR(24) *.95

  const hullSuite = hma.nextValue(bar.close, seriesClose);
  const heikinAsh = heikin.nextValue(bar.open, bar.high, bar.low, bar.close);
  const atr = ATR.nextValue({ high: bar.high, low: bar.low, close: bar.close });
  // Get the previous bar
  let prevbar = prev(series, 1);
  console.log(
    "Current Price = " +
      bar.close +
      " | " +
      bar.closetimestamp +
      " ATR | " +
      atr
  );
  if (!prevbar) return;
  larp.update(bar);

  // check for take profits
  if (larp.trade && takeProfits) {
    if (
      larp.trade.side == "long" &&
      bar.close >= larp.trade.entry + (atr * atrMultiple).toFixed(2)
    ) {
      console.log("take profit long | close= " + bar.close);
      larp.takeprofits(bar.close, 0.5, bar.closetimestamp);
    } else if (
      larp.trade.side == "short" &&
      bar.close <= larp.trade.entry - (atr * atrMultiple).toFixed(2)
    ) {
      console.log("take profit short | close = " + bar.close);
      larp.takeprofits(bar.close, 0.5, bar.closetimestamp);
    }
  }
  // Short if Red and HeikinAsh Sell
  if (
    hullSuite[1] === "RED" &&
    heikinAsh[2] === true &&
    heikinAsh[3] === true
  ) {
    console.log(
      `${bar.closetimestamp} SHORT | ${bar.close} | target=${(
        bar.close -
        atr * atrMultiple
      ).toFixed(2)} color=${hullSuite[1]} | short=${heikinAsh[2]}, ${
        heikinAsh[3]
      }`
    );

    // side, price, stop, risk, time
    larp.open(
      "short",
      bar.close,
      !stops ? null : bar.close + bar.close * stopConstant,
      100,
      bar.closetimestamp
    );
  }
  // call update to check for stops
  if (
    hullSuite[1] === "GREEN" &&
    heikinAsh[0] === true &&
    heikinAsh[1] === true
  ) {
    console.log(
      `${bar.closetimestamp}  LONG | ${bar.close} target=${(
        bar.close +
        atr * atrMultiple
      ).toFixed(2)} color=${hullSuite[1]} | long=${heikinAsh[0]} ${
        heikinAsh[1]
      }`
    );

    // side, price, stop, risk, time
    larp.open(
      "long",
      bar.close,
      !stops ? null : bar.close - bar.close * stopConstant,
      100,
      bar.closetimestamp
    );
  }

  if (larp.closed)
    console.log(
      `${bar.closetimestamp} => ${larp.lasttrade.side} \t[ ${
        larp.won ? "won" : larp.lost ? "lost" : "even"
      } ] \t${larp.lasttrade.result.percent.toFixed(2)}% | Balance: ${
        larp.balance
      } XBT`
    );
}

// Required system bootup boilerplate code
(async () => {
  if (RUN_LIVE) {
    feed.on("live", () =>
      console.log("* Running live. Waiting for the current bar to close.")
    );
  }
  feed.on("terminate", (b) => {
    console.log("Finished. Result: ");

    console.log(larp.result);

    // Uncomment below to see all the trades
    // console.log( larp.trades )
  });

  feed.on("bar", (b) => {
    series.push(b);
    seriesClose.push(b.close);
    // Limit memory usage
    series = series.slice(-MAX_HISTORICAL_BARS);
    seriesClose = seriesClose.slice(-MAX_HISTORICAL_BARS);

    // fs.writeFileSync( './bars5m.json', JSON.stringify( series ) );

    // Update pnl calculation thing
    if (larp) larp.update(b);

    // Call the user strategy code
    onclose(b, series);
  });

  // `resolution`:    (optional, default='5m' ) bar length; '1m', '5m', '1h', '1d'
  // `warmup`:        (optional) request N bars of historical data to get our system started or just backtest
  // `offline`:       (optional) just terminate after sending the historical bars ( no live processing )
  await feed.start({
    resolution: RESOLUTION,
    warmup: HISTORICAL_BARS,
    offline: !RUN_LIVE,
  });
})();

// Utility functions

// Returns milliseconds since midnight
const hms = (date) =>
  (Object.prototype.toString.call(date) === "[object Date]"
    ? date.getTime()
    : date) %
  (1000 * 60 * 60 * 24);

// Calculate percentage change between two numbers
const percent = (from, to) => ((to - from) / from) * 100;
