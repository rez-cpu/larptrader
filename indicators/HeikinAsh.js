"use-strict";
const EMA = require("technicalindicators").EMA;
const haOpenSeries = [];
const maviSeries = [];
const kirmiziSeries = [];
const lastSignal = [0];
const trendStateSeries = [];
const log = false;
// replace NaN with 0
function nz(number) {
  if (isNaN(number)) {
    return 0;
  } else {
    return number;
  }
}
class HeikinAsh {
  constructor(_length) {
    this.EMALength = _length;
    this.EMA1 = new EMA({ period: _length, values: [] });
    this.EMA2 = new EMA({ period: _length, values: [] });
    this.EMA3 = new EMA({ period: _length, values: [] });

    this.EMA4 = new EMA({ period: _length, values: [] });
    this.EMA5 = new EMA({ period: _length, values: [] });
    this.EMA6 = new EMA({ period: _length, values: [] });
    // TMA3 = 3*EMA7-3*EMA8+EMA9
    this.EMA7 = new EMA({ period: _length, values: [] });
    this.EMA8 = new EMA({ period: _length, values: [] });
    this.EMA9 = new EMA({ period: _length, values: [] });
    // TMA4 = 3*EMA10-3*EMA11+EMA12
    this.EMA10 = new EMA({ period: _length, values: [] });
    this.EMA11 = new EMA({ period: _length, values: [] });
    this.EMA12 = new EMA({ period: _length, values: [] });
  }
  //   EMA1=ema(haC,EMAlength)
  //   EMA2=ema(EMA1,EMAlength)
  //   EMA3=ema(EMA2,EMAlength)
  //   EMA4=ema(TMA1,EMAlength)
  //   EMA5=ema(EMA4,EMAlength)
  //   EMA6=ema(EMA5,EMAlength)
  //   EMA7=ema(hlc3,EMAlength)
  //   EMA8=ema(EMA7,EMAlength)
  //   EMA9=ema(EMA8,EMAlength)
  //   EMA10=ema(TMA3,EMAlength)
  //   EMA11=ema(EMA10,EMAlength)
  //   EMA12=ema(EMA11,EMAlength)
  //   src=ohlc4
  //   haOpen=0.0
  //   haOpen := (src + nz(haOpen[1]))/2
  //   haC=(ohlc4+nz(haOpen)+max(high,nz(haOpen))+min(low,nz(haOpen)))/4
  nextValue(o, h, l, c) {
    const hlc3 = (h + l + c) / 3;
    const ohlc4 = (o + h + l + c) / 4;
    const haOpen = (ohlc4 + nz(haOpenSeries[haOpenSeries.length - 1])) / 2;
    // insert haOpen for tracking (we need the previous value on the next tick)
    haOpenSeries.push(haOpen);

    const hac =
      (ohlc4 + nz(haOpen) + Math.max(h, nz(haOpen)) + Math.min(l, nz(haOpen))) /
      4;
    //   const TMA3=3*EMA7-3*EMA8+EMA9
    if (log) {
      console.log("haOpen " + haOpenSeries[haOpenSeries.length - 1]);
      console.log("hlc3 " + hlc3);
      console.log("ohlc4 " + ohlc4);
      console.log("hac " + hac);
    }

    const ema1 = this.EMA1.nextValue(nz(hac));
    const ema2 = this.EMA2.nextValue(nz(ema1));
    const ema3 = this.EMA3.nextValue(nz(ema2));

    if (log) {
      console.log("ema1 " + ema1);
      console.log("ema2 " + ema2);
      console.log("ema3 " + ema3);
    }
    // TMA1=3*EMA1-3*EMA2+EMA3
    const TMA1 = 3 * nz(ema1) - 3 * nz(ema2) + nz(ema3);

    const ema4 = this.EMA4.nextValue(nz(TMA1));
    const ema5 = this.EMA5.nextValue(nz(ema4));
    const ema6 = this.EMA6.nextValue(nz(ema5));
    if (log) {
      console.log("TMA1 " + TMA1);
      console.log("ema4 " + ema4);
      console.log("ema5 " + ema5);
      console.log("ema6 " + ema6);
    }
    const ema7 = this.EMA7.nextValue(nz(hlc3));
    const ema8 = this.EMA8.nextValue(nz(ema7));
    const ema9 = this.EMA9.nextValue(nz(ema8));

    if (log) {
      console.log("ema7 " + ema7);
      console.log("ema8 " + ema8);
      console.log("ema9 " + ema9);
    }
    const TMA3 = 3 * nz(ema7) - 3 * nz(ema8) + nz(ema9);
    const ema10 = this.EMA10.nextValue(nz(TMA3));
    const ema11 = this.EMA11.nextValue(nz(ema10));
    const ema12 = this.EMA12.nextValue(nz(ema11));

    if (log) {
      console.log("TMA3 " + TMA3);
      console.log("ema10 " + ema10);
      console.log("ema11 " + ema11);
      console.log("ema12 " + ema12);
    }
    // TMA2=3*EMA4-3*EMA5+EMA6
    const TMA2 = 3 * nz(ema4) - 3 * nz(ema5) + nz(ema6);
    // TMA4=3*EMA10-3*EMA11+EMA12
    const TMA4 = 3 * nz(ema10) - 3 * nz(ema11) + nz(ema12);
    //   TMA1=3*EMA1-3*EMA2+EMA3
    //   TMA2=3*EMA4-3*EMA5+EMA6
    //   IPEK=TMA1-TMA2
    //   YASIN=TMA1+IPEK
    //   TMA4=3*EMA10-3*EMA11+EMA12
    //   IPEK1=TMA3-TMA4
    //   YASIN1=TMA3+IPEK1

    // mavi=YASIN1
    // kirmizi=YASIN
    const IPEK1 = TMA3 - TMA4;
    const IPEK = TMA1 - TMA2;

    const YASIN1 = TMA3 + IPEK1;
    const YASIN = TMA1 + IPEK;
    const mavi = YASIN1;
    const kirmizi = YASIN;
    if (log) {
      console.log("TMA2 " + TMA2);
      console.log("TMA4 " + TMA4);
      console.log("IPEK1 " + IPEK1);
      console.log("IPEK " + IPEK);
      console.log("YASIN1 " + YASIN1);
      console.log("YASIN " + YASIN);
      console.log("mavi " + mavi);
      console.log("kirmizi " + kirmizi);

      console.log("mavi[1] " + maviSeries[maviSeries.length - 1]);
      console.log("kirmizi[1] " + kirmiziSeries[kirmiziSeries.length - 1]);
    }
    // longCond=mavi>kirmizi and mavi[1]<=kirmizi[1]
    // shortCond=mavi<kirmizi and mavi[1]>=kirmizi[1]
    // trendState  := kirmizi < mavi ? true : kirmizi > mavi ? false : trendState[1]
    // closePlot   = plot(kirmizi, title = "Close Line", color = #009900, linewidth = 10, style = line, transp = 90)
    // openPlot    = plot(mavi, title = "Open Line", color = #CC0000, linewidth = 10, style = line, transp = 90)
    // closePlotU  = plot(trendState ? kirmizi : na, transp = 100, editable = false)
    // openPlotU   = plot(trendState ? mavi : na, transp = 100, editable = false)
    // closePlotD  = plot(trendState ? na : kirmizi, transp = 100, editable = false)
    // openPlotD   = plot(trendState ? na : mavi, transp = 100, editable = false)
    // fill(openPlotU, closePlotU, title = "Up Trend Fill", color = #009900, transp = 1)
    // fill(openPlotD, closePlotD, title = "Down Trend Fill", color = #CC0000, transp = 1)

    // last_signal = 0
    // long_final  = longCond  and (nz(last_signal[1]) == 0 or nz(last_signal[1]) == -1)
    // short_final = shortCond and (nz(last_signal[1]) == 0 or nz(last_signal[1]) == 1)
    const longCond =
      mavi > kirmizi &&
      maviSeries[maviSeries.length - 1] <=
        kirmiziSeries[kirmiziSeries.length - 1];
    const shortCond =
      mavi < kirmizi &&
      maviSeries[maviSeries.length - 1] >=
        kirmiziSeries[kirmiziSeries.length - 1];

    const trendState =
      kirmizi < mavi
        ? true
        : kirmizi > mavi
        ? false
        : trendStateSeries[trendStateSeries.length - 1];
    trendStateSeries.push(trendState);
    const longFinal =
      longCond &&
      (nz(lastSignal[lastSignal.length - 1]) == 0 ||
        nz(lastSignal[lastSignal.length - 1]) == -1);
    const shortFinal =
      shortCond &&
      (nz(lastSignal[lastSignal.length - 1]) == 0 ||
        nz(lastSignal[lastSignal.length - 1]) == 1);

    if (log) {
      console.log("trendState = " + trendState);
      console.log("long " + longCond);
      console.log("shortCond " + shortCond);
      console.log("longfinal " + longFinal);
      console.log("shortFinal " + shortFinal);
    }
    maviSeries.push(mavi);
    kirmiziSeries.push(kirmizi);
    const last_signal = longFinal
      ? 1
      : shortFinal
      ? -1
      : lastSignal[lastSignal.length - 1];
    lastSignal.push(last_signal);
    return [longCond, longFinal, shortCond, shortFinal];
  }
}
module.exports = HeikinAsh;
