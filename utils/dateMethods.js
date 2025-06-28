const getDaysInMonth = function(month, year) {
    // Get the number of days in the specified month and year
    return new Date(year, month, 0).getDate();
    // Here January is 0 based
    // return new Date(year, month+1, 0).getDate();
  };

  module.exports = { getDaysInMonth };