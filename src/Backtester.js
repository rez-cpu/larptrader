// Simple simulated trading module for backtesting
// Allows to place simulated paper trades and calculate bitmex inverse contract pnl

class Backtester {
  constructor() {
    this.fees = {
      on: true,
      taker: 0.075 / 100, // BitMEX taker fees = 0.075%
      maker: 0.025 / 100, //
      mode: "makertaker", // 'makertaker': one of each, 'maker': limit orders both sides, 'taker': market orders both sides
    };

    this.stopped = false;
    this.closed = false;
    this.lost = false;
    this.won = false;
    this.even = false;

    this.balance = 1;
    this.startbalance = this.balance;
    this.trade = null;
    this.trades = [];

    this.dailywon = 0;
    this.dailylost = 0;
    this.dailytrades = 0;
    this.dailyeven = 0;

    this.lastbardate = null;

    this.totalwon = 0;
    this.totallost = 0;
    this.totaleven = 0;
  }

  open(side, price, stop, risk, timestamp) {
    this.dailytrades++;

    // Close any open trades
    if (this.trade) this._close_position(price, timestamp, false);

    this.trade = {
      side: side,
      entry: price,
      stop: stop,
      risk: risk,
      size: this.balance,
      //   stop
      //     ? this._size_by_stop_risk(risk, price, stop)
      //     : this.balance * (risk / 100),
      takeprofits: [],
      opentimestamp: timestamp,
      closetimestamp: null,
      result: {},
      meta: { initialstop: stop },
    };
  }

  get result() {
    return {
      trades: this.trades.length,
      strikerate: `${((this.totalwon / this.trades.length) * 100).toFixed(2)}%`,
      balance: this.balance,
      growth: `${percent(this.startbalance, this.balance).toFixed(2)}%`,
      won: this.totalwon,
      lost: this.totallost,
      even: this.totaleven,
    };
  }

  get lasttrade() {
    return this.trades.length ? this.trades[this.trades.length - 1] : null;
  }

  // At given price, closes a portion of the position (1.0 == 100%, 0.5 == 50%) using a market order
  takeprofits(price, portion, timestamp) {
    if (!this.trade || !this.trade.size) return;

    // TODO: round()? for contracts / XBT sizing
    let quantity = this.trade.size * portion;

    this.trade.size -= quantity;

    let pnl = this._calc_pnl_xbt(
      this.trade.side,
      this.trade.entry,
      price,
      quantity
    );

    pnl -= quantity * this.fees.taker * 2;

    this.balance += pnl;

    this.trade.takeprofits.push({
      timestamp,
      price,
      portion,
      size: quantity,
      profit: pnl,
    });
  }

  close(price, timestamp) {
    if (!this.trade) return null;

    this._close_position(price, timestamp, false);
  }

  tightenstop(price) {
    if (this.trade && this.trade.side == "long")
      this.trade.stop = Math.max(this.trade.stop, price);
    else if (this.trade && this.trade.side == "short")
      this.trade.stop = Math.min(this.trade.stop, price);
  }

  // Check for stop outs etc.
  update(bar) {
    let d = new Date(Date.parse(bar.opentimestamp));
    // console.log(this.trade);
    // Test if this is new day to reset intraday statistics
    if (this.lastbardate) {
      if (!sameday(this.lastbardate, d)) {
        this.dailywon = 0;
        this.dailylost = 0;
        this.dailytrades = 0;
        this.dailyeven = 0;
      }
    }

    this.lastbardate = d;

    this.stopped = false;
    this.closed = false;
    this.lost = false;
    this.won = false;
    this.even = false;

    if (!this.trade || !this.trade.stop) return;

    if (this.trade.side == "long") {
      if (bar.low <= this.trade.stop)
        console.log("stopped out long | ", bar.low, this.trade.stop);
      this._close_position(this.trade.stop, bar.closetimestamp, true);
    } else if (this.trade.side == "short") {
      if (bar.high >= this.trade.stop) {
        console.log("stopped out short | ", bar.high, this.trade.stop);
        this._close_position(this.trade.stop, bar.closetimestamp, true);
      }
    }
  }

  _close_position(price, timestamp, stopped = false) {
    this.trade.closetimestamp = timestamp;
    this.trade.exit = price;

    let pnl = this._calc_pnl_xbt(
      this.trade.side,
      this.trade.entry,
      this.trade.exit,
      this.trade.size
    );

    if (this.fees.on) {
      switch (this.fees.mode) {
        case "taker":
          pnl -= this.trade.size * this.fees.taker * 2;
          break;
        case "maker":
          pnl += this.trade.size * this.fees.maker * 2;
          break;
        case "makertaker":
          pnl -= this.trade.size * this.fees.taker;
          pnl += this.trade.size * this.fees.maker;
          break;
      }
    }

    let startbal = this.balance;

    this.balance += pnl;

    this.closed = true;
    this.stopped = stopped;
    this.won = pnl > 0;
    this.lost = pnl < 0;
    this.even = pnl == 0;

    if (this.won) {
      this.dailywon++;
      this.totalwon++;
    }
    if (this.lost) {
      this.dailylost++;
      this.totallost++;
    }
    if (this.even) {
      this.dailyeven++;
      this.totaleven++;
    }

    this.trade.result = {
      stopped: stopped,
      exit: this.trade.exit,
      profit: pnl,
      percent: percent(startbal, this.balance),
      balance: { before: startbal, after: this.balance },
    };
    this.trades.push(this.trade);

    this.trade = null;
  }

  _calc_pnl_xbt(side, entry, exit, size) {
    let contracts = Math.round(size * entry);
    let exit1 = 1 / exit;
    let entry1 = 1 / entry;
    return side == "short"
      ? (exit1 - entry1) * contracts
      : (entry1 - exit1) * contracts; // == XBT pnl
  }

  _size_by_stop_risk(risk, entry, stop) {
    let size_risk = this.balance * (risk / 100);
    let range = Math.abs(entry - stop);
    return entry * (size_risk / range);
  }
}

// Javascript datetime support is retarded kek
const sameday = (first, second) =>
  first.getUTCFullYear() === second.getUTCFullYear() &&
  first.getUTCMonth() === second.getUTCMonth() &&
  first.getUTCDate() === second.getUTCDate();

const percent = (from, to) => ((to - from) / from) * 100;

module.exports = Backtester;
