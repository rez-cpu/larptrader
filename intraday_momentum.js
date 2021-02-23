/*
    Pretty much exactly the same as `example_live_strategy_ma_cross.js` except uses historical 
    offline data from a file instead of pulling directly from the exchange.
    Oh and uses daily bars with an MA30 instead.

*/

// const LiveFeed      = require('./src/feed/Live');
const DiskFeed = require("./src/feed/Offline");
const Backtester = require("./src/Backtester");
const fs = require("fs");
const Indicators = require("technicalindicators");
const Aggregate = require("./mextick/Aggregate");
const HMA = require("./indicators/HMA");
// const HeikinAsh = require("./indicators/HeikinAsh");
const Firefly = require("./indicators/Firefly");

const MAX_HISTORICAL_BARS = 1000;

// Settings for your backtest/trading
const RESOLUTION = "5m"; // '1m', '5m', '1h', '1d'
const RUN_LIVE = true; // enable live trading or not
const HISTORICAL_BARS = 1000; // how many bars to download before running live/backtest (max 1000)
let dailyClose = 0;
let longTarget = null;
let shortTarget = null;
// Daily bars
const filename = __dirname + "/data/XBTUSD-1m.json";

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
const agg = new Aggregate({ files: "./trade", resolution: "1h" });
larp.fees.on = true;
larp.fees.mode = "makertaker";

agg.on("bar", (bar) => {
  console.log("bar ", bar);
});

let series = [];
let seriesClose = [];
let fireOscSeries = [];
let fireSignalSeries = [];
let hullSeries = [];
let dailyCloseSeries = [];
// short term trend momentum scalping strategy based on the FIREFLY_LB by neoButane
// 3 parts, midline (always 50), oscillator and signal line
// oscilattor >= signal BUY
// oscillator < signal SELL
// TRADE CRITERIA
// BUY/SELL signal from the Firefly
// Trading above daily close
// Oscillator trending up
// Hull Suite flipped green
// Don't trade at stupid hours
// Ideal trade time: UTC 10-17 && 20-24
// TRADE SETUP
// Stop: Use a recent low(set a min stop range though)
// Entry: 1min bar close
// Target: Take ATR(24) of hourly bars (last day of range activity)
// target = entry + HOURLY_ATR(24) * .95

// RISK MANAGEMENT
// 1% per trade
// Make sure we haven't lost tooo many trades today
// Make sure we haven't won a trade already today
// Long term; disable if drawdown exceeds -30%

// Helper to get the `index`th element of an array counting backwards from the final element
// e.g. prev( arr, 0 ) gets the last element of arr[] instead of the first
const prev = (array, index) =>
  array.length ? array[array.length - 1 - index] : null;

const hma = new HMA(180);
// best gains
// const hma = new HMA(50);
// const heikin = new HeikinAsh(17);
const firefly = new Firefly(10, 3);
const ATR = new Indicators["ATR"]({
  period: 300,
  high: [],
  low: [],
  close: [],
});

const atrMultiple = 0.95;
// This function called everytime a new bar closes
// including historical data. check the `.live` property of `bar` to see if old bar or new
// `bar`:       the current bar which just closed
// `series`:    list of all bars we've received, including the most recent one
function onclose(bar, series) {
  let goLong = false;
  let goShort = false;
  //   console.log(bar);
  // get daily close
  if (bar.closetimestamp.includes("T00:00:00.000Z")) {
    dailyClose = bar.close;
    dailyCloseSeries.push(dailyCloseSeries);
    console.log(`------ Daily Close = ${bar.close} `);
  }

  const hullSuite = hma.nextValue(bar.close, seriesClose);
  const fire = firefly.nextValue(bar.open, bar.high, bar.low, bar.close);
  const atr = ATR.nextValue({ high: bar.high, low: bar.low, close: bar.close });

  //   const heikinAsh = heikin.nextValue(bar.open, bar.high, bar.low, bar.close);
  const oscillator = fire[1];
  const signal = fire[2];
  const color = hullSuite[1];

  // Get the previous bar
  let prevbar = prev(series, 1);

  if (!prevbar) return;
  console.log(
    `close = ${bar.close.toFixed(2)}   | ${
      bar.closetimestamp
    } | dailyClose = ${dailyClose} | color= ${color} | oscillator = ${
      fire[1]
    } | signal = ${fire[2]}`
  );

  // generate trade signal
  if (
    (oscillator >= signal &&
      bar.close > dailyClose &&
      oscillator > fireOscSeries[fireOscSeries.length - 1] &&
      color === "GREEN" &&
      !larp.trade) ||
    (oscillator >= signal &&
      bar.close > dailyClose &&
      oscillator > fireOscSeries[fireOscSeries.length - 1] &&
      color === "GREEN" &&
      larp.trade.side === "short")
  ) {
    goLong = true;
    goShort = false;
    // calculate goLong target
    longTarget = bar.close * 1.005;
    shortTarget = null;
  }
  if (
    (oscillator < signal &&
      oscillator < fireOscSeries[fireOscSeries.length - 1] &&
      color === "RED" &&
      !larp.trade) ||
    (oscillator < signal &&
      oscillator < fireOscSeries[fireOscSeries.length - 1] &&
      color === "RED" &&
      larp.trade.side === "long")
  ) {
    goShort = true;
    goLong = false;
    shortTarget = bar.close - bar.close * 0.005;
    longTarget = null;
  }
  if (goShort) {
    if (bar.live)
      console.log(
        `(live) ${bar.closetimestamp} SHORT | ${bar.close} | color=${hullSuite[1]} | short=${heikinAsh[2]} | shortFinal=${heikinAsh[3]}`
      );
    console.log(
      `${bar.closetimestamp} SHORT | ${bar.close} | target=${shortTarget} | color=${color} | oscillator=${oscillator} | signal=${signal} `
    );
    // side, price, stop, risk, time
    larp.open("short", bar.close, null, 100, bar.closetimestamp);
  }
  // If daily bar crossing up the 30 SMA, long
  if (goLong) {
    if (bar.live)
      console.log(
        `(live) ${bar.closetimestamp}  LONG | ${bar.close} target=${longTarget} color=${hullSuite[1]} | long=${heikinAsh[0]} | longFinal=${heikinAsh[1]}`
      );
    console.log(
      `${bar.closetimestamp} LONG | ${bar.close} target=${longTarget} | color=${color} | oscillator=${oscillator} | signal=${signal} `
    );
    larp.open("long", bar.close, null, 100, bar.closetimestamp);
  }
  //   take profits
  console.log(bar.high, bar.low, shortTarget, longTarget, goLong);
  if (bar.high >= longTarget && goLong) {
    console.log(bar.high, longTarget);
    larp.close(bar.close, bar.closetimestamp);
  }
  if (bar.low <= shortTarget && goShort) {
    console.log(bar.low, shortTarget);
    larp.close(bar.close, bar.closetimestamp);
  }

  if (larp.closed)
    console.log(
      `${bar.closetimestamp} => ${larp.lasttrade.side} \t[ ${
        larp.won ? "won" : larp.lost ? "lost" : "even"
      } ] \t${larp.lasttrade.result.percent.toFixed(2)}% | Balance: ${
        larp.balance
      } XBT`
    );

  // push values to my series
  fireOscSeries.push(fire[1]);
  fireSignalSeries.push(fire[2]);

  fireOscSeries = fireOscSeries.slice(-MAX_HISTORICAL_BARS);
  fireSignalSeries = fireSignalSeries.slice(-MAX_HISTORICAL_BARS);

  // fullSeries.push()
}

// Required system bootup boilerplate code
(async () => {
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
