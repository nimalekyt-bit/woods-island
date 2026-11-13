var rr = () => ({ top: 0, low: 0, level: 0, avg: 0, last: -1, moved: -1e9, heard: 0, hit: !1, age: 0 }),
  ir = 1200,
  ar = 0.08;
function or(e, t, n, r) {
  let i = Math.max(0, Math.min(1, t)),
    a = e.last < 0;
  (a ? (e.top = e.low = i) : Math.abs(i - e.last) > 0.004 && (e.moved = n), (e.last = i));
  let o = i > 0.003 && n - e.moved < ir;
  e.heard += (+!!o - e.heard) * (1 - Math.exp(-r / 0.25));
  let s = 1 - Math.exp(-r / 4);
  ((e.top = i > e.top ? i : e.top + (i - e.top) * s), (e.low = i < e.low ? i : e.low + (i - e.low) * s));
  let c = Math.max(0, Math.min(1, (i - e.low) / Math.max(ar, e.top - e.low)));
  (a && (e.level = e.avg = c),
    (e.level += (c - e.level) * (1 - Math.exp(-r / (c > e.level ? 0.025 : 0.16)))),
    (e.age += r),
    (e.avg += (c - e.avg) * (1 - Math.exp(-r / Math.min(1.1, 0.2 + e.age * 0.45)))));
  let l = Math.max(0, Math.min(1, (e.level - e.avg) / (0.22 * e.avg + 0.05))),
    u = !1;
  return (
    l > 0.45 && !e.hit ? ((e.hit = !0), (u = o)) : l < 0.2 && (e.hit = !1),
    { env: 0.2 + 0.8 * Math.min(1, 0.45 * e.level + 0.9 * l), heard: e.heard, hit: u }
  );
}
var $ = 90,
  sr = {
    idle: `var(--liquid-rim, rgb(255 255 255 / 0.22))`,
    music: `#F0997B`,
    think: `#AFA9EC`,
    happy: `#97C459`,
    attn: `#EF9F27`,
    sad: `#ff6b6b`,
    eat: `#85B7EB`,
    sleep: `#5F5E5A`,
  },
  cr = 7,
  lr = (e) => Math.exp(-e * e),
  ur = 14,
  dr = 620,
  fr = new Set();
function pr() {
  fr.forEach((e) => e());
}
function mr({
  mood: e,
  accent: t,
  ears: n = !1,
  round: r = !1,
  rain: i = !1,
  tint: a = null,
  scaled: o = !1,
}) {
  let s = (0, ReactRuntime.useRef)(null),
    c = (0, ReactRuntime.useRef)({ mood: e, accent: t, ears: n, round: r, rain: i, scaled: o });
  c.current = { mood: e, accent: t, ears: n, round: r, rain: i, scaled: o };
  let l = (0, ReactRuntime.useRef)(null),
    u = a ? `color-mix(in srgb, ${a} 30%, var(--color-island))` : `var(--color-island)`,
    d = (0, ReactRuntime.useRef)(u);
  return (
    (d.current = u),
    (0, ReactRuntime.useEffect)(() => {
      l.current && (l.current.style.stopColor = u);
    }, [u]),
    (0, ReactRuntime.useEffect)(() => {
      let e = s.current,
        t = e?.parentElement;
      if (!e || !t) return;
      let n = (t, n) => {
          let r = document.createElementNS(z, t);
          for (let e in n) r.setAttribute(e, n[e]);
          return (e.appendChild(r), r);
        },
        r = n(`g`, {}),
        i = `liquid-${Math.random().toString(36).slice(2)}`,
        a = n(`linearGradient`, {
          id: i,
          gradientUnits: `userSpaceOnUse`,
          x1: `0`,
          x2: `0`,
          y1: `0`,
          y2: `30`,
        }),
        o = (e, t) => {
          let n = document.createElementNS(z, `stop`);
          return (
            n.setAttribute(`offset`, e),
            (n.style.stopColor = t),
            (n.style.transition = `stop-color 0.45s ease`),
            a.appendChild(n),
            n
          );
        };
      (o(`0.35`, `var(--color-island)`), (l.current = o(`1`, d.current)));
      let u = n(`path`, {});
      ((u.style.fill = `url(#${i})`), (u.style.stroke = `var(--island-edge, transparent)`));
      let f = n(`path`, { fill: `none`, "stroke-width": `1.8`, "stroke-linecap": `round` }),
        p = new Float32Array($),
        m = new Float32Array($),
        h = new Float32Array($),
        g = 150,
        _ = 30,
        v = 30,
        ee = 150,
        te = 0,
        y = 0,
        b = c.current.mood,
        x = performance.now(),
        S = 0,
        ne = !1,
        re = !1,
        ie = 0,
        ae = 0,
        C = !1,
        oe = -1e9,
        w = null,
        se = [],
        ce = rr(),
        le = new Float32Array(Math.ceil($ / cr)).fill(1),
        T = new Float32Array(le.length),
        E = 0,
        D = () => Math.min(_ / 2, _ > 60 ? 32 : 26),
        ue = (e) => {
          let t = D(),
            n = g / 2 - t,
            r = Math.abs(e);
          if (r <= n) return _;
          let i = Math.min(t, r - n);
          return _ - t + Math.sqrt(Math.max(0, t * t - i * i));
        },
        O = (e) => -g / 2 + (e / 89) * g,
        k = (e) => Math.sin((Math.PI * e) / 89) ** 0.7,
        A = (e, t, n) => {
          for (let r = 0; r < $; r++) m[r] += t * lr((O(r) - e) / n) * k(r);
        },
        j = (e, t, n, i) => {
          let a = document.createElementNS(z, `g`),
            o = document.createElementNS(z, `circle`);
          (o.setAttribute(`r`, String(i)),
            (o.style.fill = `var(--color-island)`),
            (o.style.stroke = `var(--island-edge, transparent)`));
          let s = document.createElementNS(z, `circle`);
          (s.setAttribute(`r`, String(Math.max(1, i * 0.28))),
            s.setAttribute(`cx`, String(-i * 0.35)),
            s.setAttribute(`cy`, String(-i * 0.35)),
            s.setAttribute(`fill`, `#FFFFFF`),
            s.setAttribute(`opacity`, `0.4`),
            a.append(o, s),
            r.appendChild(a));
          let c = { x: e, y: t, vy: n, r: i, g: a, age: 0, mode: `fall` };
          return (se.push(c), c);
        },
        M = (e) => {
          let t = `${e[0][0].toFixed(1)},${e[0][1].toFixed(1)}`;
          for (let n = 1; n < e.length - 1; n++) {
            let r = [(e[n][0] + e[n + 1][0]) / 2, (e[n][1] + e[n + 1][1]) / 2];
            t += ` Q${e[n][0].toFixed(1)},${e[n][1].toFixed(1)} ${r[0].toFixed(1)},${r[1].toFixed(1)}`;
          }
          let n = e[e.length - 1];
          return t + ` L${n[0].toFixed(1)},${n[1].toFixed(1)}`;
        },
        N = (e) => {
          let t = Math.min(0.05, S ? (e - S) / 1e3 : 0.016);
          S = e;
          let n = c.current.mood;
          n !== b && ((b = n), (x = e), (ne = !1), (re = !1), n === `music` && A(0, -120, 80));
          let r = e - x,
            i = P(),
            a = (_ - v) / Math.max(t, 0.004);
          !C && a < -300 && _ < v ? (C = !0) : C && a > -40 && ((C = !1), (oe = _ < 70 ? e : e - dr * 0.45));
          let o = C || e - oe < dr,
            s = C ? 0 : Math.min(1, Math.max(0, (e - oe - dr * 0.45) / (dr * 0.55))),
            l = Math.max(-140, Math.min(140, -(a - te) * 0.45));
          if (Math.abs(l) > 0.5) for (let e = 1; e < 89; e++) m[e] += l * k(e);
          ((Math.abs(_ - v) > 0.3 || Math.abs(g - ee) > 0.3) && (y = e + 400), (te = a), (v = _), (ee = g));
          let u = 0,
            d = 0;
          if (b === `music`) {
            let n = or(ce, useIslandStore.getState().level, e, t);
            if (((u = n.env), (d = n.heard), n.hit))
              for (let e = 0; e < le.length; e++) le[e] = 0.5 + 0.5 * Math.random();
          }
          let D = useIslandStore.getState(),
            M =
              b === `music` &&
              D.settings?.liquidSpectrum === !0 &&
              D.bands.length > 1 &&
              performance.now() - D.bandsAt < 700
                ? D.bands
                : null;
          E += (+!!M - E) * (1 - Math.exp(-t / 0.2));
          for (let e = 0; e < T.length; e++) {
            let n = 0;
            if (M) {
              let t = T.length > 1 ? (e / (T.length - 1)) ** 1.2 * (M.length - 1) : 0,
                r = Math.floor(t),
                i = Math.min(M.length - 1, r + 1);
              n = M[r] + (M[i] - M[r]) * (t - r);
            }
            T[e] += (n - T[e]) * (1 - Math.exp(-t / (n > T[e] ? 0.02 : 0.11)));
          }
          let N = Lt(),
            I = N ? { x: N.x - (i.left + g / 2), y: N.y - i.top } : null;
          for (let t = 0; t < $; t++) {
            let n = O(t),
              i = k(t),
              a = 0;
            if ((b === `idle` && (a = 2.5 * Math.sin(t * 0.12 + e / 1100)), b === `music`)) {
              let n = 0.25 + 0.75 * Math.max(0, Math.sin((e / 545) * Math.PI)) ** 2,
                r = n + (u - n) * d,
                i = 1 + (le[Math.floor(t / cr)] - 1) * d,
                o = (t % cr) - 3,
                s = Math.max(0, 1 - Math.abs(o) / 3.5),
                c = r * i,
                l = c + (0.1 + 0.9 * T[Math.floor(t / cr)] - c) * E,
                f = Math.min(t, 89 - t) - 4,
                p = Math.max(0, Math.min(1, f / 6)),
                m = p * p * (3 - 2 * p);
              a = Math.min(30, _ * 0.9) * l * s * s * (1 + (m - 1) * E);
            }
            if (
              (b === `think` && (a = 4 * Math.sin(t * 0.32 - e / 130)),
              b === `happy` && (a = r < 520 ? 18 * Math.min(1, r / 520) * lr(n / 26) : 0),
              b === `attn` || b === `sad`)
            ) {
              let n = (t % 5) - 2,
                r = Math.max(0, 1 - Math.abs(n) / 2.5);
              a = (10 + 3 * Math.sin(e / 30 + t)) * r * r;
            }
            if (
              (b === `eat` && (a = r < 700 ? 12 * Math.min(1, r / 700) * lr(n / 24) : 0),
              b === `sleep` && (a = 10 * i ** 2 + 1.2 * Math.sin(e / 1500)),
              I && b !== `sleep` && I.y > _ * 0.6 && Math.abs(I.x) < g / 2 + 60)
            ) {
              let e = 22 * Math.exp(-Math.max(0, I.y - _) / 140);
              a += e * lr((n - I.x) / 40);
            }
            h[t] = a * i * s;
          }
          let L = !o && (b === `music` || b === `attn` || b === `sad`),
            R = L ? 80 : 700,
            fe = L ? 420 : b === `sleep` ? 40 : 70,
            pe = L ? 30 : 6,
            me = t / 8;
          for (let e = 0; e < 8; e++) {
            for (let e = 1; e < 89; e++)
              m[e] += (R * (p[e - 1] + p[e + 1] - 2 * p[e]) - fe * (p[e] - h[e]) - pe * m[e]) * me;
            let e = Math.min(25, _ * 0.45);
            for (let t = 1; t < 89; t++)
              ((p[t] = Math.min(50, p[t] + m[t] * me)), p[t] < -e && ((p[t] = -e), m[t] < 0 && (m[t] = 0)));
            p[0] = p[89] = m[0] = m[89] = 0;
          }
          (b === `happy` &&
            r >= 520 &&
            !ne &&
            ((ne = !0), j(0, _ + 12, 40, Math.min(7, _ * 0.22)), A(0, -240, 20)),
            b === `eat` && r >= 700 && !re && ((re = !0), A(0, -360, 22)),
            b === `idle` && e - ie > 3600 && ((ie = e), A((Math.random() - 0.5) * g * 0.6, -120, 16)),
            b === `idle` &&
              c.current.rain &&
              e - ae > 1500 + Math.random() * 900 &&
              ((ae = e), j((Math.random() - 0.5) * g * 0.7, _ + 4, 26, 2.3)),
            b === `think` && !w
              ? ((w = j(0, _ + 20, 0, 4)), (w.mode = `orbit`))
              : b !== `think` && w && ((w.mode = `home`), (w = null)),
            (se = se.filter((n) => {
              if (((n.age += t), n.mode === `orbit`)) {
                let t = e / 650;
                ((n.x = Math.cos(t) * g * 0.32), (n.y = _ + 20 + Math.sin(t * 2) * 6));
              } else if (n.mode === `fall`) {
                if (
                  ((n.vy += 520 * t),
                  (n.y += n.vy * t),
                  b === `happy` && n.age > 0.5 && (n.mode = `home`),
                  (n.r < 4 &&
                    (n.g.setAttribute(`opacity`, Math.max(0, 1 - n.age / 1.3).toFixed(2)), n.age > 1.3)) ||
                    n.y > _ + 120 ||
                    n.age > 3)
                )
                  return (n.g.remove(), !1);
              } else if (
                ((n.vy += (-60 * (n.y - (ue(n.x) - 2)) - 5 * n.vy) * t),
                (n.y += n.vy * t),
                n.y < ue(n.x) + n.r * 0.6 || n.age > 4)
              )
                return (A(n.x, -300, 18), n.g.remove(), !1);
              return (n.g.setAttribute(`transform`, `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`), !0);
            })),
            de());
          let he = b === `music` && c.current.accent ? c.current.accent : sr[b];
          ((f.style.stroke = he),
            f.setAttribute(
              `opacity`,
              b === `sleep`
                ? `0.35`
                : b === `attn`
                  ? (0.5 + 0.4 * Math.abs(Math.sin(e / 120))).toFixed(2)
                  : `0.75`,
            ));
        },
        P = () => {
          let n = t.getBoundingClientRect();
          if (c.current.scaled) {
            let e = getComputedStyle(t);
            ((g = parseFloat(e.width)), (_ = parseFloat(e.height)));
          } else ((g = n.width), (_ = n.height));
          return (
            e.setAttribute(`width`, g.toFixed(2)),
            e.setAttribute(`height`, (_ + 120).toFixed(1)),
            e.setAttribute(`viewBox`, `${(-g / 2).toFixed(2)} 0 ${g.toFixed(2)} ${(_ + 120).toFixed(1)}`),
            n
          );
        },
        I = 30,
        de = () => {
          let e = [];
          for (let t = 0; t < $; t++) {
            let n = O(t);
            e.push([n, ue(n) + p[t]]);
          }
          let t = D(),
            n = g / 2,
            r = Math.max(0, _ - t),
            i = c.current.ears ? Math.min(ur, r) : 0,
            o = c.current.round && i === 0 ? t : 0,
            s = c.current.ears ? -2 : 0,
            l = (e) => e.toFixed(2);
          (u.setAttribute(
            `d`,
            `M${l(-n - i + o)},${s} H${l(n + i - o)}` +
              (s < 0 ? ` V0` : ``) +
              (i > 0 ? ` A${l(i)},${l(i)} 0 0 0 ${l(n)},${l(i)}` : ``) +
              (o > 0 ? ` A${l(o)},${l(o)} 0 0 1 ${l(n)},${l(o)}` : ``) +
              ` L${l(n)},${l(r)} L` +
              M(e.slice().reverse()) +
              ` L${l(-n)},${l(r)}` +
              (i > 0 ? ` L${l(-n)},${l(i)} A${l(i)},${l(i)} 0 0 0 ${l(-n - i)},0` : ``) +
              (o > 0 ? ` L${l(-n)},${l(o)} A${l(o)},${l(o)} 0 0 1 ${l(-n + o)},0` : ``) +
              ` Z`,
          ),
            f.setAttribute(`d`, `M` + M(e.slice(4, 86).map(([e, t]) => [e, t - 2.2]))),
            _ !== I && (a.setAttribute(`y2`, l(_)), (I = _)),
            me(e, n, r));
        },
        L = t.querySelector(`:scope > [data-liquid-clip]`),
        R = L?.querySelector(`:scope > [data-liquid-squash]`) ?? null,
        fe = !1,
        pe = !1,
        me = (e, t, n) => {
          if (!L) return;
          let r = 0,
            i = 0,
            a = 0;
          for (let e = 0; e < $; e++)
            ((r = Math.max(r, -p[e])), e > $ * 0.15 && e < $ * 0.85 && ((i += p[e]), a++));
          if (((i /= a), r > 5)) {
            let r = (e) => e.toFixed(1),
              i = M(e.map(([e, n]) => [e + t, n]).reverse());
            ((L.style.clipPath = `path("M0,0 H${r(2 * t)} L${r(2 * t)},${r(n)} L${i} L0,${r(n)} Z")`),
              (fe = !0));
          } else fe &&= ((L.style.clipPath = ``), !1);
          if (!R) return;
          let o = Math.max(0, Math.min(1, (90 - _) / 42)),
            s = i < -3 ? i * Math.min(1, (-i - 3) / 4) : 0,
            c = s < 0 && o > 0 ? 1 + (s / Math.max(_, 1)) * o : 1;
          c < 1
            ? ((R.style.transform = `scaleY(${c.toFixed(3)})`), (pe = !0))
            : (pe &&= ((R.style.transform = ``), !1));
        },
        he = () => {
          let e = g,
            t = _;
          (P(), (g !== e || _ !== t) && de());
        };
      (fr.add(he), N(performance.now()));
      let ge = Sn(N, () => {
        if (performance.now() < y) return 0;
        let e = c.current.mood;
        return e === `sleep` ? 50 : e === `idle` ? 16 : 0;
      });
      return () => {
        (ge(),
          fr.delete(he),
          (l.current = null),
          e.replaceChildren(),
          L && (L.style.clipPath = ``),
          R && (R.style.transform = ``));
      };
    }, []),
    (0, jsxRuntime.jsx)(`svg`, {
      ref: s,
      className: `pointer-events-none absolute top-0 left-0 overflow-visible`,
      "aria-hidden": !0,
    })
  );
}
