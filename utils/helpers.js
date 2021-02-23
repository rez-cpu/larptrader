"use-strict";

// replace NaN with 0
function nz(number) {
  if (isNaN(number)) {
    return 0;
  } else {
    return number;
  }
}

//replace undefineds with nothing
function nn(number) {
  if (isNaN(number)) {
    return;
  }
}

function round(number) {
  if (number) {
    return number.toFixed(2);
  } else {
    return number;
  }
}
module.exports = { nz, round };
