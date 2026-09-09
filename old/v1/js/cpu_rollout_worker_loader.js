(() => {
  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  let armed = true;

  URL.createObjectURL = function (object) {
    if (armed && object instanceof Blob && object.type === 'application/javascript') {
      armed = false;
      URL.createObjectURL = originalCreateObjectURL;
      return './js/cpu_rollout_worker.js?v=20260807203200000000';
    }
    return originalCreateObjectURL(object);
  };
})();
