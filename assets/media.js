// Plays the silent loop videos only while they are on screen. With reduced motion they stay on their
// still picture; switching reduced motion on later stops them.
(function () {
  const videos = Array.from(document.querySelectorAll('video[data-autoplay]'));
  if (videos.length === 0) return;

  // a model video covers its still picture only once it really plays
  videos.forEach((video) => video.addEventListener('playing', () => video.classList.add('playing')));

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  function play(video) {
    const started = video.play();
    if (started && typeof started.catch === 'function') started.catch(() => {});
  }

  let observer = null;
  if (typeof IntersectionObserver !== 'function') {
    videos.forEach(play);
  } else {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) play(entry.target);
        else entry.target.pause();
      });
    });
    videos.forEach((video) => observer.observe(video));
  }

  if (typeof reduce.addEventListener === 'function') {
    reduce.addEventListener('change', (event) => {
      if (!event.matches) return;
      if (observer && typeof observer.disconnect === 'function') observer.disconnect();
      videos.forEach((video) => video.pause());
    });
  }
})();
