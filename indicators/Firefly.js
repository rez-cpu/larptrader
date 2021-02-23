"use-strict";

const EMA = require("technicalindicators").EMA;
const math = require("mathjs");

const { nz, round } = require("../utils/helpers");
let v2Series = [];
let v5Series = [];
let v7Series = [];
let wwSeries = [0];
let dSeries = [];

const MAX_HISTORICAL_BARS = 1000;
class Firefly {
  // study(title = "Firefly Oscillator [LazyBear]", shorttitle="FIREFLY_LB")
  // m=input(10,title= "Lookback Length", minval= 5, maxval=20)
  // n1=input(3, title="Signal Smoothing", minval=3, maxval=10)
  // as=input(false, title="Double smooth Osc")
  // bt=input(false, title="Use ZLEMA")
  // seb=input(false, title="Show Enclosing BB")
  // lbb=input(20, title="Enclosing BB Length")
  // mbb1=input(2.0, title="Enclosing BB Multiplier")
  // hbr=input(false, title="Highlight Breaches")
  // ebc=input(false, title="Enable bar colors")
  // calc_zlema(src, length) =>
  //     ema1=ema(src, length)
  //     ema2=ema(ema1, length)
  //     d=ema1-ema2
  //     ema1+d
  // ma(s,l) => bt == false ? ema(s,l) : calc_zlema(s,l)
  // v2=(high+low+close*2)/4
  // v3=ma(v2,m)
  // v4=stdev(v2,m)
  // v5=(v2-v3)*100/iff(v4==0,1,v4)
  // v6=ma(v5,n1)
  // v7=as?ma(v6,n1):v6
  // ww=(ma(v7,m)+100)/2-4
  // mm=highest(ww,n1)
  // plot(ww!=50 and mm!=50 and ((ww>50 and mm>50) or (ww<50 and mm<50))?50:na, color=gray, style=linebr, title="Midline")
  // d=ww>50?min(ww,mm):mm<50?max(ww,mm):na
  // dc=d>50?d>d[1]?green:orange:d<d[1]?red:orange
  // plot(seb?na:d, title="Histo", linewidth=2, color=dc, histbase=50, style=histogram)
  // wwl=plot(ww, title="Oscillator", linewidth=1, color=red)
  // mml=plot(mm, title="Signal", linewidth=1, color=green)
  // fill(wwl,mml,red, transp=60, title="OscillatorSignal Fill")
  // basis = seb?sma(ww, lbb):na
  // dev = seb?mbb1 * stdev(ww, lbb):na
  // upper = seb?basis + dev:na
  // lower = seb?basis - dev:na
  // // Uncomment the next line to show BB midline
  // //plot(basis, color=#0066CC, title="Enclosing BB Mid")
  // p1 = plot(seb?upper:na, color=gray, title="Enclosing BB Upper")
  // p2 = plot(seb?lower:na, color=gray, title="Enclosing BB Lower")
  // fill(p1,p2, gray, title="Enclosing BB Fill")
  // b_color = (ww > upper) ? red : (ww < lower) ? green : na
  // bgcolor(hbr ? b_color : na)
  // bc=ebc?d>50?d>d[1]?lime:orange:d<d[1]?red:orange:na
  // barcolor(bc)

  constructor(_m, _n1, lbb, bb1, hbr, ebc) {
    this.m = _m; // lookback length
    this.n1 = _n1; // signal smoothing
    this.as = false; // double smooth osc
    this.bt = false; // use ZLEMA
    this.lbb = 20; // enclosing bb length
    this.mbb1 = 2; // enclosing bb multiplier
    this.hbr = false; // highlight breaches
    this.v2 = null; // (high + low  close * 2)/4
    this.v2EMA = new EMA({ period: this.m, values: [] });
    this.v6EMA = new EMA({ period: this.n1, values: [] });
    this.v7EMA = new EMA({ period: this.m, values: [] });
    this.v4 = null;
    this.v5 = null;
    this.v6 = null;
    this.v7 = null;
    this.ww = null;
    this.mm = null;
    this.oscillator = null;
    this.signal = null;
    this.d = null;
    this.dc = null;
  }

  nextValue(open, high, low, close) {
    // console.log("-------------------------");
    this.v2 = (high + low + close * 2) / 4;
    this.v3 = this.v2EMA.nextValue(nz(this.v2));

    v2Series.push(nz(this.v2.toFixed(2)));
    this.v4 = math.std(
      v2Series.length >= this.m ? v2Series.slice(-this.m) : [0],
      "uncorrected"
    );

    this.v5 = ((this.v2 - this.v3) * 100) / (this.v4 === 0 ? 1 : this.v4);
    v5Series.push(nz(this.v5.toFixed(2)));

    this.v6 = this.v6EMA.nextValue(nz(this.v5));

    this.v7 = nz(this.v6);
    const next = nz(this.v7EMA.nextValue(nz(this.v7)));
    v7Series.push(nz(this.v7.toFixed(2)));

    this.ww = (next + 100) / 2 - 4;
    wwSeries.push(nz(this.ww.toFixed(2)));

    this.mm = Math.max(...wwSeries.slice(-3));

    this.oscillator = this.ww;
    this.signal = this.mm;

    // histo
    this.d =
      this.ww > 50
        ? Math.min(this.ww, this.mm)
        : this.mm < 50
        ? Math.max(this.ww, this.mm)
        : null;
    // console.log("d " + this.d);
    // // dSeries.push(d);
    // // this.dc = this.d > 50 ? this.dd > dSeries[dSeries.length - 1]
    // console.log("v2 = " + this.v2);
    // console.log("this.v3 " + this.v3);

    // console.log("this.v4 std = " + this.v4);
    // console.log("this.v5 " + this.v5);
    // console.log("next = " + next);
    // console.log("this.v7 = " + this.v7);

    // console.log("oscillator " + this.oscillator);
    // console.log("signal " + this.signal);
    // console.log("-------------------------");

    v2Series = v2Series.slice(-MAX_HISTORICAL_BARS);
    v5Series = v5Series.slice(-MAX_HISTORICAL_BARS);
    v7Series = v7Series.slice(-MAX_HISTORICAL_BARS);
    wwSeries = wwSeries.slice(-MAX_HISTORICAL_BARS);
    // reasign variables to save memory
    return [round(this.d), round(this.oscillator), round(this.signal)];
  }
}

module.exports = Firefly;
