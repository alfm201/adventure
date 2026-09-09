(function () {
  var canvas = document.getElementById("game_screen");
  var link = document.getElementById("current-version-link");
  link.href += location.search + location.hash;

  function place() {
    var rect = canvas.getBoundingClientRect();
    var scaleX = rect.width / 1234;
    var scaleY = rect.height / 694;
    link.style.left = (rect.left + 984 * scaleX) + "px";
    link.style.top = (rect.top + 642 * scaleY) + "px";
    link.style.transform = "scale(" + scaleX + "," + scaleY + ")";
  }

  window.addEventListener("resize", place);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", place);
  place();
}());
