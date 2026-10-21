/* Shared behavior for every page on arlenamarie.com.
   Load at the end of <body>, then call the helpers from the page's own
   config script. Per-page numbers live in that config, not here. */
(function () {
  const root = getComputedStyle(document.documentElement);
  const cssVar = name => root.getPropertyValue(name).trim();

  const palette = {
    cream: cssVar('--cream'),
    ink: cssVar('--ink'),
    stars: [1, 2, 3, 4, 5, 6].map(i => cssVar(`--star-${i}`)),
  };

  /* ── Wiggle title ──
     el:   the title element (gets the --wiggle-* variables)
     text: the letters to split
     opts:
       step        delay between letters, in seconds
       offset      index to start counting from (continues delays across rows)
       countSpaces whether a space advances the delay index
       space       { html, width, animate } for how a space is drawn
       rot, lift, spd   wiggle size and speed
       glow, glowFaint  pulse colors; omit for no glow
       driver      'css' (default, keyframe wiggle) or 'gsap' (page animates letters) */
  function title(el, text, opts) {
    const o = Object.assign({ step: 0.15, offset: 0, countSpaces: true, space: {} }, opts);
    if (o.rot)  el.style.setProperty('--wiggle-rot', o.rot);
    if (o.lift) el.style.setProperty('--wiggle-lift', o.lift);
    if (o.spd)  el.style.setProperty('--wiggle-spd', o.spd);
    if (o.driver === 'gsap') el.dataset.motion = 'gsap';
    if (o.glow) {
      el.classList.add('glow');
      el.style.setProperty('--glow', o.glow);
      el.style.setProperty('--glow-faint', o.glowFaint);
    }

    let idx = o.offset;
    text.split('').forEach(ch => {
      const s = document.createElement('span');
      if (ch === ' ') {
        if (o.space.html) s.innerHTML = o.space.html;
        if (o.space.width) { s.style.width = o.space.width; s.style.display = 'inline-block'; }
        if (o.space.animate) s.className = 'wiggle-letter';
        el.appendChild(s);
        if (o.countSpaces) idx++;
        return;
      }
      s.className = 'wiggle-letter';
      s.textContent = ch;
      s.style.setProperty('--d', `${idx * o.step}s`);
      el.appendChild(s);
      idx++;
    });
  }

  /* ── Star SVG (five points, ink outline) ── */
  function star(sz, fill) {
    const ns = 'http://www.w3.org/2000/svg';
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 45 : 18;
      const a = Math.PI / 5 * i - Math.PI / 2;
      pts.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
    }
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', sz);
    svg.setAttribute('height', sz);
    svg.setAttribute('viewBox', '0 0 100 100');
    const pg = document.createElementNS(ns, 'polygon');
    pg.setAttribute('points', pts.join(' '));
    pg.setAttribute('fill', fill);
    pg.setAttribute('stroke', palette.ink);
    pg.setAttribute('stroke-width', 2.5);
    pg.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(pg);
    return svg;
  }

  /* ── Orbit ──
     ring:     the .orbit-ring element (its parent is the .orbit-anchor)
     opts:
       count     number of items, spaced evenly around the ellipse
       duration  one full turn, e.g. '50s'
       position  'absolute' (inside .world) or 'fixed' (viewport centered)
       z         z-index of the anchor
       item(i)   returns { node or html, sz, box }; box sizes the wrapper to sz
       radius()  returns { rx, ry } in px from the center
       relayout  recompute positions on window resize */
  function orbit(ring, opts) {
    const anchor = ring.parentElement;
    anchor.style.setProperty('--orbit-duration', opts.duration);
    anchor.style.setProperty('--orbit-position', opts.position || 'fixed');
    anchor.style.setProperty('--orbit-z', opts.z == null ? 1 : opts.z);

    const sizes = [];
    function place(d, i, rx, ry) {
      const a = Math.PI * 2 / opts.count * i;
      d.style.left = `${rx * Math.cos(a) - sizes[i] / 2}px`;
      d.style.top  = `${ry * Math.sin(a) - sizes[i] / 2}px`;
    }

    // Each item is positioned before it joins the ring, then filled
    const start = opts.radius();
    for (let i = 0; i < opts.count; i++) {
      const it = opts.item(i);
      sizes.push(it.sz);
      const d = document.createElement('div');
      d.className = 'orbit-item';
      place(d, i, start.rx, start.ry);
      if (it.box) { d.style.width = `${it.sz}px`; d.style.height = `${it.sz}px`; }
      if (it.html) d.innerHTML = it.html; else d.appendChild(it.node);
      ring.appendChild(d);
    }

    if (opts.relayout) {
      window.addEventListener('resize', () => {
        const { rx, ry } = opts.radius();
        ring.querySelectorAll('.orbit-item').forEach((d, i) => place(d, i, rx, ry));
      });
    }
  }

  /* ── World orbit (homepage) ──
     Each item sits in a slot the size of .world and is moved with
     translate(x%, y%), so the ellipse is in percent of .world and a resize
     needs no JS. GSAP only advances each item's angle.
     container: an empty element covering .world
     opts:
       count, rx, ry   items and ellipse radii in % of .world
       duration        seconds per turn
       item(i)         returns the node to place (the star) */
  function worldOrbit(container, opts) {
    const angles = [];
    const slots = [];
    const items = [];
    const place = i => {
      const a = angles[i].a;
      slots[i].style.transform = `translate(${opts.rx * Math.cos(a)}%, ${opts.ry * Math.sin(a)}%)`;
    };
    for (let i = 0; i < opts.count; i++) {
      const slot = document.createElement('div');
      slot.className = 'orbit-slot';
      const it = document.createElement('div');
      it.className = 'orbit-star';
      it.appendChild(opts.item(i));
      slot.appendChild(it);
      container.appendChild(slot);
      angles.push({ a: Math.PI * 2 / opts.count * i });
      slots.push(slot);
      items.push(it);
      place(i);
    }
    return {
      items,
      // Start item i moving (call when it lands)
      start(i) {
        loop(window.gsap.to(angles[i], {
          a: `+=${Math.PI * 2}`, duration: opts.duration, ease: 'none', repeat: -1,
          onUpdate: () => place(i),
        }));
      },
    };
  }

  /* ── GSAP loader ──
     gsap core only, pinned with SRI. Pages that preload it list the same
     URL and hash in their <head>; change all three together. */
  const GSAP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/gsap.min.js';
  const GSAP_SRI = 'sha512-oJ8QbaQThQoJZ7oEv+29jfPM6CcP+zUxh3PKJs1vyOhx0UraUrE7PQgeItu3dOuCJyrzWpoYMsVjkkPEBzbUqw==';
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gsapLoad;

  function loadGsap() {
    if (!gsapLoad) {
      gsapLoad = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = GSAP_SRC;
        s.integrity = GSAP_SRI;
        s.crossOrigin = 'anonymous';
        s.referrerPolicy = 'no-referrer';
        s.onload = () => { html.classList.add('motion'); resolve(window.gsap); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return gsapLoad;
  }

  /* Run fn(gsap, { intro, reduced }) once gsap is loaded.
     intro is true when the page asked for one (html.intro, set in <head>,
     never under reduced motion) and gsap arrived within 3 s. Otherwise the
     intro class is dropped so the page shows its final layout, and fn should
     skip straight to idle motion. Reduced motion only removes transitions
     (intro, view transition); ambient loops still run. */
  function motion(fn) {
    const giveUp = setTimeout(() => html.classList.remove('intro'), 3000);
    loadGsap().then(gsap => {
      clearTimeout(giveUp);
      fn(gsap, { intro: html.classList.contains('intro'), reduced });
    }, () => {
      clearTimeout(giveUp);
      html.classList.remove('intro');
    });
  }

  /* ── Back/forward cache ──
     A page restored from the back/forward cache keeps its JS state, but
     mobile browsers can bring it back with GSAP's ticker asleep, which
     freezes the orbit and the letter wiggle. On restore: finish the intro
     without replaying it, drop html.intro, wake the ticker and resume every
     idle loop. Pages register loops with Site.loop() and the intro with
     Site.intro(); worldOrbit registers its own. */
  const loops = [];
  let introTl = null;

  function loop(tween) { loops.push(tween); return tween; }
  function intro(tl) { introTl = tl; return tl; }

  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    html.classList.remove('intro');
    const gsap = window.gsap;
    if (!gsap) return;
    // Jumping to the end fires the intro's callbacks, which start any orbit
    // or wiggle that had not landed yet
    if (introTl && introTl.progress() < 1) introTl.progress(1);
    gsap.ticker.wake();          // restarts the requestAnimationFrame loop
    gsap.globalTimeline.resume();
    loops.forEach(t => { if (t.paused()) t.resume(); });
    // Watchdog: if GSAP's clock still has not moved, wake the ticker again
    const t0 = gsap.ticker.time;
    setTimeout(() => { if (gsap.ticker.time === t0) gsap.ticker.wake(); }, 500);
  });

  /* ── Hover (needs gsap; call inside Site.motion) ──
     One quickTo owns --s, which CSS feeds to the scale property. A second
     owns --swap, which cross-fades the icons and drops the label (site.css).
     quickTo always retargets from the current value, so rapid in/out can
     never leave the element mid-state.
     opts: scale (hover, default 1.12), press (default 1.04), swap (default true) */
  function hover(el, opts) {
    const o = Object.assign({ scale: 1.12, press: 1.04, swap: true }, opts);
    const gsap = window.gsap;
    gsap.set(el, { '--s': 1, '--swap': 0 });
    const s = gsap.quickTo(el, '--s', { duration: 0.28, ease: 'power2.out' });
    const sw = o.swap ? gsap.quickTo(el, '--swap', { duration: 0.22, ease: 'power1.out' }) : null;
    let over = false;

    const scaleTo = (v, d) => { s.tween.duration(d); s(v); };
    const show = on => {
      over = on;
      scaleTo(on ? o.scale : 1, 0.28);
      if (sw) sw(on ? 1 : 0);
    };
    // Jump straight to the true state (no tween)
    const snap = () => {
      over = el.matches(':hover');
      s(over ? o.scale : 1, over ? o.scale : 1);
      if (sw) sw(over ? 1 : 0, over ? 1 : 0);
    };

    el.addEventListener('pointerenter', () => show(true));
    el.addEventListener('pointerleave', () => show(false));
    el.addEventListener('pointercancel', () => show(false));
    el.addEventListener('pointerdown', () => scaleTo(o.press, 0.1));
    el.addEventListener('pointerup', () => scaleTo(over ? o.scale : 1, 0.28));
    // Back/forward cache restores the page as it was left; resync to the pointer
    window.addEventListener('pageshow', e => { if (e.persisted) snap(); });
    // The CSS fallback may already be showing hover if gsap arrived mid-hover
    if (el.matches(':hover')) show(true);
  }

  /* ── Sprite hover (needs gsap; call inside Site.motion, next to Site.hover) ──
     Plays a one-row sprite sheet forward on hover and back on leave, as an
     <img> in a div.sprite window over the tile's idle icon (site.css).
     The tile names its sheet: data-sprite (URL) and data-frames (count);
     the frame count gives each frame's share of the sheet. The window takes
     the idle icon's own aspect (its natural size), so it is exactly where
     the idle icon is drawn even when the idle WebP's size was rounded (a
     frame of 517x280 fit into 280 px is 280x151.6; the WebP is 280x152).
     A tile needs nothing else. The sheet is fetched after window load and
     no earlier than SHEETS_AT (1.2 s from navigation start, when the title
     letters have mostly landed), at fetchpriority low (the <img> gets its
     src then). Until a sheet has decoded, its tile keeps the cross-fade and
     a tap navigates at once.
     Once ready, .has-sprite hides the hover icon, and .sprite-on shows the
     sprite (and hides the idle icon) on frames 1 and up. Frame 0 is always
     the idle <img> itself, so hover starts with no jump: two images drawn at
     the same spot still resample their edges slightly differently. One tween
     per tile, retargeted on every event (overwrite) from the current frame
     at the same frames per second both ways, so rapid in/out never sticks;
     frames are rounded, so it never lands between two. .sprite-on follows
     the drawn frame, so it can never disagree with it.
     Scale and label stay with Site.hover.
     Touch: a tap plays the sprite to its last frame, then follows the link
     (a scripted same-origin navigation, so the view transition still runs).
     A second tap while it plays follows the link at once; a tap on another
     tile cancels this one. Touch pointers fire enter and leave around every
     tap, so they do not drive the sprite. A tap counts as touch when the
     pointer is touch, or the device has no hover and the pointer is not a
     mouse. Mouse clicks and keyboard (click with detail 0) follow the link
     at once, as before.
     opts: duration (first to last frame, s, default 0.9) */
  let tapping = null;  // the tile whose tap is playing toward navigation
  const SHEETS_AT = 1200;  // ms from navigation start before sprite sheets load
  const noHover = window.matchMedia('(hover: none)');

  function spriteHover(el, opts) {
    const o = Object.assign({ duration: 0.9 }, opts);
    const gsap = window.gsap;
    const src = el.dataset.sprite;
    const frames = +el.dataset.frames;
    const last = frames - 1;
    const div = document.createElement('div');
    div.className = 'sprite';
    div.setAttribute('aria-hidden', 'true');
    div.style.setProperty('--frames', frames);
    const sheet = document.createElement('img');
    sheet.alt = '';
    sheet.draggable = false;
    div.appendChild(sheet);
    el.querySelector('.tile-img').appendChild(div);

    const state = { f: 0 };
    let ready = false;
    const draw = () => {
      const f = Math.round(state.f);
      div.style.setProperty('--frame', f);
      el.classList.toggle('sprite-on', f > 0);
    };
    draw();
    const play = on => {
      if (!ready) return;
      const to = on ? last : 0;
      gsap.to(state, {
        f: to, duration: Math.abs(to - state.f) / last * o.duration, ease: 'none', overwrite: true,
        onUpdate: draw, onComplete: draw,
      });
    };
    // Jump straight to the true state (no tween). Touch screens leave :hover
    // stuck on the last tapped element, so only a hovering mouse counts.
    let lastType = '';
    const snap = () => {
      gsap.killTweensOf(state);
      state.f = lastType !== 'touch' && !noHover.matches && el.matches(':hover') ? last : 0;
      draw();
    };

    const tap = {
      el,
      cancel() { tapping = null; play(false); },
      go() { tapping = null; window.location.href = el.href; },
    };

    const load = () => {
      sheet.fetchPriority = 'low';
      sheet.src = src;
      const idle = el.querySelector('.idle');
      Promise.all([sheet.decode(), idle.decode()]).then(() => {
        div.style.setProperty('--fw', idle.naturalWidth);
        div.style.setProperty('--fh', idle.naturalHeight);
        el.classList.add('has-sprite');
        ready = true;
        if (el.matches(':hover')) play(true);
      }, () => {});  // sheet failed: the cross-fade stays
    };
    // After window load, and no earlier than SHEETS_AT
    const later = () => setTimeout(load, Math.max(0, SHEETS_AT - performance.now()));
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });

    const touch = e => e.pointerType === 'touch';
    el.addEventListener('pointerdown', e => { lastType = e.pointerType; });
    el.addEventListener('pointerenter', e => { if (!touch(e)) play(true); });
    el.addEventListener('pointerleave', e => { if (!touch(e)) play(false); });
    el.addEventListener('pointercancel', e => { if (!touch(e)) play(false); });

    el.addEventListener('click', e => {
      if (!ready || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.detail === 0) return;                    // keyboard
      const type = e.pointerType || lastType;        // Safari may leave pointerType off the click
      if (type === 'mouse' || !(type === 'touch' || noHover.matches)) return;
      e.preventDefault();
      if (tapping === tap) { gsap.killTweensOf(state); tap.go(); return; }  // second tap: go now
      if (tapping) tapping.cancel();
      tapping = tap;
      gsap.to(state, {
        f: last, duration: (last - state.f) / last * o.duration, ease: 'none', overwrite: true,
        onUpdate: draw, onComplete: () => { draw(); if (tapping === tap) tap.go(); },
      });
    });
    // Back/forward cache restores the page as it was left; resync to the pointer
    window.addEventListener('pageshow', e => {
      if (!e.persisted || !ready) return;
      if (tapping === tap) tapping = null;
      snap();
    });
  }

  window.Site = { palette, title, star, orbit, worldOrbit, motion, hover, spriteHover, loop, intro, reduced };
})();
