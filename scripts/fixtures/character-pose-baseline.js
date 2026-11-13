function Nn(e) {
  let t = { mood: null, since: 0, poke: -1e9, blinkAt: 0, lx: 0, ly: 0, sy: 1, vsy: 0, last: 0 };
  return {
    st: t,
    pose(n, r, i, a, o) {
      let s = Math.min(0.05, t.last ? (n - t.last) / 1e3 : 0.016);
      ((t.last = n),
        t.mood !== r && (t.mood !== null && ((t.poke = n), (t.vsy -= 3.4)), (t.mood = r), (t.since = n)));
      let c = gn(r),
        l = i * 3,
        u = 0,
        d = Lt();
      if (d && o && !e()) {
        let e = o.getBoundingClientRect();
        [l, u] = Nt(d.x - (e.left + e.width / 2), d.y - (e.top + e.height / 2));
      }
      (c === `think` && ((l = 0), (u = -2)),
        (t.lx += (l - t.lx) * Math.min(1, s * 10)),
        (t.ly += (u - t.ly) * Math.min(1, s * 10)));
      let f = 1;
      if (((t.blinkAt ||= n + 1200 + Math.random() * 2500), n > t.blinkAt)) {
        let e = n - t.blinkAt;
        ((f = e < 70 ? 1 - e / 70 : e < 140 ? (e - 70) / 70 : 1),
          e > 140 && (t.blinkAt = n + 2500 + Math.random() * 3500));
      }
      let p = (n - t.poke) / 1e3,
        m = p < 0.6 ? Math.sin((p / 0.6) * Math.PI) : 0;
      ((t.vsy += (-190 * (t.sy - 1) - 11 * t.vsy) * s), (t.sy += t.vsy * s));
      let h = Mn(t.sy, 0.7, 1.3);
      return {
        pose: {
          s: c,
          c: r === `sad` ? `#ff6b6b` : c === `music` && a ? a : at[c],
          lx: t.lx,
          ly: t.ly,
          blink: f,
          poke: m,
        },
        t: n - t.since,
        dt: s,
        pop: [1 + (1 - h) * 0.8, h],
      };
    },
  };
}
var Pn = 9;
function Fn(e, t, n) {
  let r = Math.sin(t / 900) * 2,
    i = 1,
    a = 1,
    o = 0;
  if (e === `music`) {
    let e = (t % 545) / 545,
      n = Math.max(0, 1 - e * 4);
    ((r = -Math.abs(Math.sin(e * Math.PI)) * 6),
      (a = 1 - 0.1 * n),
      (i = 1 + 0.08 * n),
      (o = Math.sin((t / 545) * Math.PI) * 5));
  }
  if (e === `done`) {
    let e = n / 1e3,
      t = Math.exp(-e * 1.4),
      o = Math.abs(Math.sin(e * Math.PI * 1.7));
    r = -o * Pn * t;
    let s = (1 - o) ** 8 * t;
    ((a = 1 - 0.2 * s), (i = 1 + 0.15 * s));
  }
  return (
    e === `attn` && (o = n % 1400 < 300 ? Math.sin(n / 25) * 6 : 0),
    e === `sleep` && ((r = 3), (a = 1 + 0.035 * Math.sin(t / 1100)), (i = 1 - 0.02 * Math.sin(t / 1100))),
    { y: r, sx: i, sy: a, rot: o }
  );
}
