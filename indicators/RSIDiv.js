"use-strict";

const { lowest } = require("technicalindicators");

const RSI = require("technicalindicators").RSI;
const nz = require("../utils/helpers.js");

// track highest/lowest bars in array
let rsiHistory = [];
let maxSeries = [];
let maxRsiSeries = [];
let minSeries = [];
let minRsiSeries = [];

const lookback = -90;

class RSIDiv {
  constructor(_length) {
    this.RSI = new RSI({ period: _length, values: [] });
    this.length = _length;
  }
  //   xbars = input(defval=90, title="Div lookback period (bars)?", type=input.integer, minval=1)
  //   hb = abs(highestbars(rsi, xbars)) // Finds bar with highest value in last X bars
  //   lb = abs(lowestbars(rsi, xbars)) // Finds bar with lowest value in last X bars

  // If bar with lowest / highest is current bar, use it's value
  // max := hb == 0 ? close : na(max[1]) ? close : max[1]
  // max_rsi := hb == 0 ? rsi : na(max_rsi[1]) ? rsi : max_rsi[1]
  // min := lb == 0 ? close : na(min[1]) ? close : min[1]
  // min_rsi := lb == 0 ? rsi : na(min_rsi[1]) ? rsi : min_rsi[1]

  // Compare high of current bar being examined with previous bar's high
  // If curr bar high is higher than the max bar high in the lookback window range
  // if close > max // we have a new high
  //     max := close // change variable "max" to use current bar's high value
  // if rsi > max_rsi // we have a new high
  //     max_rsi := rsi // change variable "max_rsi" to use current bar's RSI value
  // if close < min // we have a new low
  //     min := close // change variable "min" to use current bar's low value
  // if rsi < min_rsi // we have a new low
  //     min_rsi := rsi // change variable "min_rsi" to use current bar's RSI value

  // // Finds pivot point with at least 2 right candles with lower value
  // pivoth := (max_rsi == max_rsi[2]) and (max_rsi[2] != max_rsi[3]) ? true : na
  // pivotl := (min_rsi == min_rsi[2]) and (min_rsi[2] != min_rsi[3]) ? true : na

  // // Detects divergences between price and indicator with 1 candle delay so it filters out repeating divergences
  // if (max[1] > max[2]) and (rsi[1] < max_rsi) and (rsi <= rsi[1])
  //     divbear := true
  // if (min[1] < min[2]) and (rsi[1] > min_rsi) and (rsi >= rsi[1])
  //     divbull := true

  nextValue(close) {
    // calculate pivot high, low, bull, bear
    // insert history into the array
    const rsiValue = this.RSI.nextValue(close);
    rsiHistory.push(nz(rsiValue));
    // only store 90 values back for memory
    rsiHistory = rsiHistory.slice(lookback);

    // Finds bar with highest value in last 90 (this.lookback) bars
    const hb = Math.max(...rsiHistory);
    // Finds bar with highest value in last 90 (this.lookback) bars ex 0
    const lb = Math.min(...rsiHistory);
    // If bar with lowest / highest is current bar, use it's value

    let max =
      hb === 0
        ? close
        : isNaN(maxSeries[maxSeries.length - 1])
        ? close
        : maxSeries[maxSeries.length - 1];

    let maxRsi =
      hb === 0
        ? rsiValue
        : isNaN(maxRsiSeries[maxRsiSeries.length - 1])
        ? rsiValue
        : maxRsiSeries[maxRsiSeries.length - 1];

    let min =
      lb === 0
        ? close
        : isNaN(minSeries[minSeries.length - 1])
        ? close
        : minSeries[minSeries.length - 1];

    let minRsi =
      lb === 0
        ? rsiValue
        : isNaN(minRsiSeries[minRsiSeries.length - 1])
        ? rsiValue
        : minRsiSeries[minRsiSeries.length - 1];

    // Compare high of current bar being examined with previous bar's high
    // If curr bar high is higher than the max bar high in the lookback window range
    if (close > max) {
      // we have a new high
      max = close; // change variable "max" to use current bar's high value
    }
    if (rsiValue > maxRsi) {
      // we have a new high
      maxRsi = rsiValue; // change variable "max_rsi" to use current bar's RSI value
    }

    if (close < min) {
      // we have a new low
      min = close; // change variable "min" to use current bar's low value
    }
    if (rsiValue < minRsi) {
      // we have a new low
      minRsi = rsiValue; // change variable "min_rsi" to use current bar's RSI value
    }
    // console.log("hb = " + hb, "lb = " + lb);
    // console.log("max = " + max, "maxRsi = " + maxRsi);
    // console.log("min = " + min, "minRsi = " + minRsi);

    maxSeries.push(max);
    maxSeries = maxSeries.slice(-3);
    maxRsiSeries.push(maxRsi);
    maxRsiSeries = maxRsiSeries.slice(-3);
    minSeries.push(min);
    minSeries = minSeries.slice(-3);
    minRsiSeries.push(minRsi);
    minRsiSeries = minRsiSeries.slice(-3);

    // // Finds pivot point with at least 2 right candles with lower value
    const pivoth =
      maxRsi === maxRsiSeries[maxRsiSeries.length - 2] &&
      maxRsiSeries[maxRsiSeries.length - 2] !==
        maxRsiSeries[maxRsiSeries.length - 3]
        ? true
        : false;
    const pivotl =
      minRsi === minRsiSeries[minRsiSeries.length - 2] &&
      minRsiSeries[minRsiSeries.length - 2] !==
        minRsiSeries[minRsiSeries.length - 3]
        ? true
        : false;
    let divbear = false;
    let divbull = false;
    // // Detects divergences between price and indicator with 1 candle delay so it filters out repeating divergences
    if (
      maxSeries[maxSeries.length - 1] > maxSeries[maxSeries.length - 2] &&
      rsiHistory[rsiHistory.length - 1] < maxRsi &&
      rsiValue <= rsiHistory[rsiHistory.length - 1]
    ) {
      divbear = true;
    }

    if (
      minSeries[minSeries.length - 1] < minSeries[minSeries.length - 2] &&
      rsiHistory[rsiHistory.length - 1] > minRsi &&
      rsiValue >= rsiHistory[rsiHistory.length - 1]
    ) {
      divbull = true;
    }

    // console.log(divbear, divbull, pivoth, pivotl);

    return [divbear, divbull, pivoth, pivotl, rsiValue];
  }
}

module.exports = RSIDiv;
