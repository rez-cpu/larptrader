"use-strict";

const WMA = require("technicalindicators").WMA;

const seriesData = [];

class HMA {
  // return the HMA value for inSilico technical indicator
  // InSilico HMA formula
  // wma(2 * wma(_src, _length / 2) - wma(_src, _length), round(sqrt(_length)))
  // src = close, length = 55
  constructor(_length) {
    // establish value src, length and close value
    this.length = _length;
    this.divisor = Math.floor(_length / 2);
    // create 2 indepdendt WMAs to calculate the Hull Suite Value
    this.WMA1 = new WMA({ period: this.divisor, values: [] });
    this.WMA2 = new WMA({
      period: _length,
      values: [],
    });
    this.HMA = new WMA({ period: Math.round(Math.sqrt(_length)), values: [] });
  }

  nextValue(close) {
    // calculate WMA of w1
    const w1 = this.WMA1.nextValue(close);
    const w2 = this.WMA2.nextValue(close);
    const combined = 2 * w1 - w2;
    const hma1 = this.HMA.nextValue(combined);
    // console.log(w1);
    // console.log(w2);
    // console.log(combined);
    // console.log(hma1);
    // calculate color, if HULL (current) > HULL (2 bars back) = green
    // track hma1 in seriesData
    seriesData.push(hma1);
    const color = hma1 > seriesData[seriesData.length - 2] ? "GREEN" : "RED";
    return [hma1, color];
  }
}

module.exports = HMA;
