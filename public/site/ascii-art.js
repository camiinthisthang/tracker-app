/* dropdeck — live ASCII halftone engine (vanilla, no deps)
   Renders a photograph as a field of type characters, brightness-mapped.
   Pointer acts as a lens: the real photograph shows through a soft circle.
   Respects prefers-reduced-motion (static render, no shimmer).            */

(function(){
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class AsciiHalftone {
    constructor(canvas, opts={}){
      this.cv = canvas;
      this.opts = Object.assign({
        src: canvas.dataset.src,
        chars: canvas.dataset.chars || ' .:-=+*%@#',
        cell: parseFloat(canvas.dataset.cell || 10),   // css px per glyph cell
        color: canvas.dataset.color || '#c2333a',
        dim:   canvas.dataset.dim   || '#7e1d21',
        faint: canvas.dataset.faint || '#3c1012',
        bg:    canvas.dataset.bg    || '#0c0a09',
        lens:  canvas.dataset.lens !== 'off',
        lensRadius: parseFloat(canvas.dataset.lensRadius || 130),
        invert: canvas.dataset.invert === 'true',
        font: canvas.dataset.font || '"JetBrains Mono", "Space Mono", monospace',
      }, opts);
      this.ctx = canvas.getContext('2d');
      this.mouse = {x:-9999, y:-9999, r:0, tr:0};
      this.reveal = 1;            // full render is the default state
      this._sweepStarted = false; // intro sweep only runs if rAF actually ticks
      this.playing = false;
      this.shimmerCells = [];
      this._raf = null;
      this.ready = this._load();
    }

    async _load(){
      const img = new Image();
      await new Promise((res, rej)=>{
        img.onload = res; img.onerror = rej;
        img.src = this.opts.src;
        if (img.complete && img.naturalWidth) res();
      });
      this.img = img;
      // a cached image can resolve before first layout (or while the page is
      // hidden/offscreen) — wait as long as it takes for a real size
      if (!this.cv.clientWidth){
        await new Promise(r=>{
          const ro = new ResizeObserver(()=>{
            if (this.cv.clientWidth){ ro.disconnect(); r(); }
          });
          ro.observe(this.cv);
        });
      }
      this._measure();
      this._bind();
      this._observe();
      this._renderStatic();
      this._draw();
    }

    _measure(){
      const dpr = Math.min(window.devicePixelRatio||1, 2);
      const w = this.cv.clientWidth, h = this.cv.clientHeight;
      if (!w || !h) return false;
      this.w = w; this.h = h; this.dpr = dpr;
      this.cv.width = Math.round(w*dpr); this.cv.height = Math.round(h*dpr);
      this.ctx.setTransform(dpr,0,0,dpr,0,0);
      const cell = this.opts.cell;
      this.cols = Math.ceil(w/cell); this.rows = Math.ceil(h/cell);

      // sample image luminance into cols x rows (cover-fit)
      const s = document.createElement('canvas');
      s.width = this.cols; s.height = this.rows;
      const sx = s.getContext('2d');
      const ir = this.img.width/this.img.height, cr = w/h;
      let dw, dh;
      if (ir > cr){ dh = this.rows; dw = this.rows*ir; } else { dw = this.cols; dh = this.cols/ir; }
      sx.drawImage(this.img, (this.cols-dw)/2, (this.rows-dh)/2, dw, dh);
      const data = sx.getImageData(0,0,this.cols,this.rows).data;
      this.lum = new Float32Array(this.cols*this.rows);
      // auto-contrast: stretch to the image's own range, then gamma-lift mids
      let mn=1, mx=0;
      const raw = new Float32Array(this.cols*this.rows);
      for(let i=0;i<raw.length;i++){
        let l = (0.2126*data[i*4] + 0.7152*data[i*4+1] + 0.0722*data[i*4+2])/255;
        if (this.opts.invert) l = 1-l;
        raw[i]=l; if(l<mn)mn=l; if(l>mx)mx=l;
      }
      const span = Math.max(0.0001, mx-mn);
      for(let i=0;i<raw.length;i++){
        this.lum[i] = Math.pow((raw[i]-mn)/span, 0.72);
      }
      // offscreen full ascii render
      this.off = document.createElement('canvas');
      this.off.width = this.cv.width; this.off.height = this.cv.height;
      // cover-fit rect for drawing the real photo through the lens
      const cw = w, ch = h;
      if (ir > cw/ch){ this.ph = ch; this.pw = ch*ir; } else { this.pw = cw; this.ph = cw/ir; }
      this.px = (cw-this.pw)/2; this.py = (ch-this.ph)/2;
    }

    _glyph(l){
      const cs = this.opts.chars;
      const i = Math.floor(l*cs.length);
      if (!isFinite(i)) return '';
      return cs[Math.max(0, Math.min(cs.length-1, i))] || '';
    }

    _renderStatic(){
      const ox = this.off.getContext('2d');
      ox.setTransform(this.dpr,0,0,this.dpr,0,0);
      ox.fillStyle = this.opts.bg;
      ox.fillRect(0,0,this.w,this.h);
      const cell = this.opts.cell;
      ox.font = `700 ${cell*1.3}px ${this.opts.font}`;
      ox.textBaseline = 'top';
      for(let r=0;r<this.rows;r++){
        for(let c=0;c<this.cols;c++){
          const l = this.lum[r*this.cols+c];
          if (!(l >= 0.10)) continue;
          ox.fillStyle = l > 0.62 ? this.opts.color : (l > 0.32 ? this.opts.dim : this.opts.faint);
          ox.fillText(this._glyph(l), c*cell, r*cell);
        }
      }
    }

    _bind(){
      if (this.opts.lens && !REDUCED){
        this.cv.addEventListener('pointermove', e=>{
          const b = this.cv.getBoundingClientRect();
          this.mouse.x = e.clientX-b.left; this.mouse.y = e.clientY-b.top;
          this.mouse.tr = this.opts.lensRadius;
        });
        this.cv.addEventListener('pointerleave', ()=>{ this.mouse.tr = 0; });
      }
      let t;
      window.addEventListener('resize', ()=>{
        clearTimeout(t);
        t = setTimeout(()=>{ if (this._measure() === false) return; this._renderStatic(); this._draw(); }, 150);
      });
    }

    _observe(){
      const io = new IntersectionObserver(es=>{
        es.forEach(e=>{
          if (e.isIntersecting){
            this.playing = true;
            if (!this._sweepStarted && !REDUCED){
              this._sweepStarted = true;
              // only blank + sweep once a frame is guaranteed to follow
              requestAnimationFrame(()=>{ this._t0 = performance.now(); this.reveal = 0; this._loop(); });
            } else {
              this._loop();
            }
          }
          else { this.playing = false; cancelAnimationFrame(this._raf); }
        });
      }, {threshold: 0.05});
      io.observe(this.cv);
    }

    _loop(){
      if(!this.playing) return;
      // reveal sweep, time-based
      if (this._t0 !== undefined && this.reveal < 1){
        this.reveal = Math.min(1, (performance.now()-this._t0)/1200);
      }
      // lens easing
      this.mouse.r += (this.mouse.tr - this.mouse.r)*0.12;
      // shimmer: refresh a few random cells
      if (!REDUCED && Math.random() < 0.5){
        this.shimmerCells = Array.from({length:14}, ()=>[
          Math.floor(Math.random()*this.cols), Math.floor(Math.random()*this.rows)]);
      }
      this._draw();
      this._raf = requestAnimationFrame(()=>this._loop());
    }

    _draw(){
      const x = this.ctx, w=this.w, h=this.h;
      x.fillStyle = this.opts.bg;
      x.fillRect(0,0,w,h);
      // revealed ascii rows
      const rh = h*this.reveal;
      x.drawImage(this.off, 0,0,this.off.width, this.off.height*this.reveal, 0,0,w,rh);
      // shimmer
      if (this.shimmerCells.length){
        const cell = this.opts.cell;
        x.font = `700 ${cell*1.3}px ${this.opts.font}`;
        x.textBaseline = 'top';
        const cs = this.opts.chars;
        for(const [c,r] of this.shimmerCells){
          if (r*cell > rh) continue;
          const l = this.lum[r*this.cols+c];
          if (!(l >= 0.1)) continue;
          x.fillStyle = this.opts.bg;
          x.fillRect(c*cell, r*cell, cell, cell);
          x.fillStyle = Math.random()<.5 ? this.opts.color : this.opts.dim;
          x.fillText(cs[Math.floor(Math.random()*cs.length)] || '', c*cell, r*cell);
        }
      }
      // lens: real photograph through a soft circle
      if (this.mouse.r > 1){
        x.save();
        x.beginPath();
        x.arc(this.mouse.x, this.mouse.y, this.mouse.r, 0, Math.PI*2);
        x.clip();
        x.drawImage(this.img, this.px, this.py, this.pw, this.ph);
        x.restore();
        x.beginPath();
        x.arc(this.mouse.x, this.mouse.y, this.mouse.r, 0, Math.PI*2);
        x.strokeStyle = this.opts.color;
        x.lineWidth = 1.5;
        x.stroke();
      }
    }

    setDensity(cell){
      this.opts.cell = cell;
      if (this._measure() === false) return;
      this._renderStatic(); this._draw();
    }
  }

  window.AsciiHalftone = AsciiHalftone;
  window.__asciiInstances = [];
  window.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('canvas[data-ascii]').forEach(cv=>{
      window.__asciiInstances.push(new AsciiHalftone(cv));
    });
    // re-render once webfonts arrive so glyphs use the brand mono
    if (document.fonts && document.fonts.ready){
      document.fonts.ready.then(()=>{
        window.__asciiInstances.forEach(a=>{
          if (a.lum){ a._renderStatic(); a._draw(); }
        });
      });
    }
  });
})();
