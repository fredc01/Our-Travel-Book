// Little bursts of cuteness.
const FX = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function burst(x, y, emojis = ["💖", "✨", "🌸", "💗"], n = 8) {
    if (reduce) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = "pop";
      s.textContent = emojis[i % emojis.length];
      const a = (Math.PI * 2 * i) / n + Math.random() * .6, d = 50 + Math.random() * 70;
      s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px`;
      document.body.appendChild(s);
      s.addEventListener("animationend", () => s.remove());
    }
  }
  function confetti() {
    const e = ["🎉", "💖", "✨", "🌈", "🎈"];
    for (let i = 0; i < 6; i++) setTimeout(() => burst(innerWidth * (.15 + Math.random() * .7), innerHeight * .35, e, 6), i * 90);
  }
  document.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("input, textarea, select, dialog")) return;
    burst(ev.clientX, ev.clientY, undefined, 5);
  });
  return { burst, confetti };
})();
