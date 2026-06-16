/* dropdeck v2 — live halftone dot engine (vanilla, no deps)
   Renders a photograph as a grid of dots, brightness-mapped — the brand-book
   halftone texture, made live. Pointer acts as a lens: the real photograph
   shows through a soft circle. Respects prefers-reduced-motion.            */

(function(){
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class HalftoneArt {
    constructor(canvas, opts={}){
      this.cv = canvas;
      this.opts = Object.assign({
        src: canvas.dataset.src,
        cell: parseFloat(canvas.dataset.cell || 12),    // css px per dot cell
        dot: canvas.dataset.dot || '#FFE4E4',
        hi:  canvas.dataset.hi  || '#FFFFFF',
        bg:  canvas.dataset.bg  || '#EE2324',
        lens: canvas.dataset.lens !== 'off',
        lensRadius: parseFloat(canvas.dataset.lensRadius || 140),
        invert: canvas.dataset.invert === 'true',
        sparkle: canvas.dataset.sparkle !== 'off',
      }, opts);
      this.ctx = canvas.getContext('2d');
      this.mouse = {x:-9999, y:-9999, r:0, tr:0};
      this.reveal = 1;
      this._sweepStarted = false;
      this.playing = false;
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

      const s = document.createElement('canvas');
      s.width = this.cols; s.height = this.rows;
      const sx = s.getContext('2d');
      const ir = this.img.width/this.img.height, cr = w/h;
      let dw, dh;
      if (ir > cr){ dh = this.rows; dw = this.rows*ir; } else { dw = this.cols; dh = this.cols/ir; }
      sx.drawImage(this.img, (this.cols-dw)/2, (this.rows-dh)/2, dw, dh);
      const data = sx.getImageData(0,0,this.cols,this.rows).data;
      this.lum = new Float32Array(this.cols*this.rows);
      let mn=1, mx=0;
      const raw = new Float32Array(this.cols*this.rows);
      for(let i=0;i<raw.length;i++){
        let l = (0.2126*data[i*4] + 0.7152*data[i*4+1] + 0.0722*data[i*4+2])/255;
        if (this.opts.invert) l = 1-l;
        raw[i]=l; if(l<mn)mn=l; if(l>mx)mx=l;
      }
      const span = Math.max(0.0001, mx-mn);
      for(let i=0;i<raw.length;i++){
        this.lum[i] = Math.pow((raw[i]-mn)/span, 0.78);
      }
      this.off = document.createElement('canvas');
      this.off.width = this.cv.width; this.off.height = this.cv.height;
      const cw = w, ch = h;
      if (ir > cw/ch){ this.ph = ch; this.pw = ch*ir; } else { this.pw = cw; this.ph = cw/ir; }
      this.px = (cw-this.pw)/2; this.py = (ch-this.ph)/2;
    }

    _renderStatic(){
      const ox = this.off.getContext('2d');
      ox.setTransform(this.dpr,0,0,this.dpr,0,0);
      ox.fillStyle = this.opts.bg;
      ox.fillRect(0,0,this.w,this.h);
      const cell = this.opts.cell, half = cell/2;
      const twinkle = this.opts.sparkle && !REDUCED;
      this.sparks = [];
      for(let r=0;r<this.rows;r++){
        for(let c=0;c<this.cols;c++){
          const l = this.lum[r*this.cols+c];
          if (l < 0.07) continue;
          const rad = Math.min(half*1.04, half*1.18*Math.pow(l, 0.95));
          const cx = c*cell+half, cy = r*cell+half;
          const isHi = l > 0.82 && this.opts.sparkle;
          if (isHi && twinkle){
            // highlight dots are animated live in _draw (twinkle); base stays dot-colored
            this.sparks.push({x:cx, y:cy, rad:rad, ph:Math.random()*Math.PI*2, sp:0.45+Math.random()*1.1});
          }
          ox.fillStyle = (isHi && !twinkle) ? this.opts.hi : this.opts.dot;
          ox.beginPath();
          ox.arc(cx, cy, rad, 0, Math.PI*2);
          ox.fill();
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
      if (this._t0 !== undefined && this.reveal < 1){
        this.reveal = Math.min(1, (performance.now()-this._t0)/1100);
      }
      this.mouse.r += (this.mouse.tr - this.mouse.r)*0.12;
      this._draw();
      const twinkling = !REDUCED && this.sparks && this.sparks.length > 0;
      const settled = this.reveal >= 1 && Math.abs(this.mouse.tr - this.mouse.r) < 0.5 && !twinkling;
      if (!settled || this.mouse.r > 1){
        this._raf = requestAnimationFrame(()=>this._loop());
      } else {
        // idle: wait for next pointer move to resume
        const resume = ()=>{ if(this.playing && !this._rafActive()){ this._loop(); } };
        this.cv.addEventListener('pointermove', resume, {once:true});
      }
    }

    _rafActive(){ return false; }

    _draw(){
      const x = this.ctx, w=this.w, h=this.h;
      x.fillStyle = this.opts.bg;
      x.fillRect(0,0,w,h);
      const rh = h*this.reveal;
      if (rh > 0){
        x.drawImage(this.off, 0,0,this.off.width, Math.max(1,this.off.height*this.reveal), 0,0,w,Math.max(1,rh));
      }
      if (this.sparks && this.sparks.length && rh > 0){
        const tm = performance.now()/1000;
        x.fillStyle = this.opts.hi;
        for (const s of this.sparks){
          if (s.y > rh) continue;
          x.globalAlpha = Math.pow(0.5 + 0.5*Math.sin(tm*s.sp*2.2 + s.ph), 2);
          x.beginPath();
          x.arc(s.x, s.y, s.rad, 0, Math.PI*2);
          x.fill();
        }
        x.globalAlpha = 1;
      }
      if (this.mouse.r > 1){
        x.save();
        x.beginPath();
        x.arc(this.mouse.x, this.mouse.y, this.mouse.r, 0, Math.PI*2);
        x.clip();
        x.drawImage(this.img, this.px, this.py, this.pw, this.ph);
        x.restore();
        x.beginPath();
        x.arc(this.mouse.x, this.mouse.y, this.mouse.r, 0, Math.PI*2);
        x.strokeStyle = this.opts.dot;
        x.lineWidth = 1.5;
        x.stroke();
      }
    }

    setDensity(cell){
      this.opts.cell = cell;
      if (this._measure() === false) return;
      this._renderStatic(); this._draw();
    }

    setColors(bg, dot, hi){
      if (bg) this.opts.bg = bg;
      if (dot) this.opts.dot = dot;
      if (hi) this.opts.hi = hi;
      this._renderStatic(); this._draw();
    }

    setSparkle(on){
      this.opts.sparkle = !!on;
      if (!this.lum) return;
      cancelAnimationFrame(this._raf);
      this._renderStatic();
      this._draw();
      if (this.playing) this._raf = requestAnimationFrame(()=>this._loop());
    }
  }

  window.HalftoneArt = HalftoneArt;
  window.__halftoneInstances = [];
  window.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('canvas[data-halftone]').forEach(cv=>{
      window.__halftoneInstances.push(new HalftoneArt(cv));
    });
  });
})();
