// Which year the pages show: ?ano=2024 loads that year's data (data/cosmos-2024.js),
// otherwise the current one. A year with no file falls back to the current year.
(function () {
  var y = new URLSearchParams(location.search).get('ano');
  if (!/^\d{4}$/.test(y || '')) y = null;
  document.write('<script src="data/cosmos' + (y ? '-' + y : '') + '.js"><\/script>');
  if (y) document.write('<script>window.COSMOS_DATA || location.replace(location.pathname)<\/script>');
})();
