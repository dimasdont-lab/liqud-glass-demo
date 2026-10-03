/* Incremental live DOM textures for Liquid Studio. The real page is never
 * replaced, scrolled or moved by this module. Each input node is one block;
 * scrolling and transforms belong to the WebGL compositor, not to snapshots.
 */
(() => {
  'use strict';

  const EXCLUDED = '.bottom-zone,.vf-contour-zoom-stack,.dock-zoom-surfaces,.vf-webgl-glass,.vf-mirror-content,.top-atmosphere,script,iframe';
  const MOTION_STYLE = /^(?:transform|translate|scale|rotate|transition(?:-.+)?|animation(?:-.+)?|will-change|perspective(?:-.+)?|--(?:vf|dock)-(?:motion|translate|scale|progress).*)$/i;
  const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ignored = node => {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    return !!element?.closest?.(EXCLUDED);
  };
  const styleIdentity = (value, root) => String(value || '').split(';').map(s => s.trim()).filter(s => {
    const name = s.slice(0, s.indexOf(':')).trim();
    return name && !MOTION_STYLE.test(name) && !(root && name === 'opacity');
  }).sort().join(';');

  class VFDomTextureCache {
    /** capture/snapshot are optional dependency injection seams. Production
     * uses html2canvas and its own isolated same-origin, script-free iframe.
     * Uploaded textures are straight-alpha, top-to-bottom DOM coordinates.
     */
    constructor(gl, options = {}) {
      this.gl = gl;
      this.options = options;
      this.records = [];
      this.byNode = new Map();
      this.pending = null;
      this.destroyed = false;
      this.lastMotion = -Infinity;
      this.serial = 0;
      this.frame = null;
      this.frameDocument = null;
      this.headRevision = 1;
      this.copiedHeadRevision = 0;
      this.maxSide = Math.min(4096, Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096);
      this.maxPixels = Math.max(1, options.maxPixels || 12 * 1024 * 1024);
      this.stats = { captures: 0, uploads: 0, allocations: 0, lastCaptureMs: 0, errors: [] };
      this.onFonts = () => this.refresh();
      if (typeof MutationObserver !== 'undefined' && document.head) {
        this.headObserver = new MutationObserver(() => {
          this.headRevision++;
          this.refresh();
        });
        this.headObserver.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true });
      }
      document.fonts?.addEventListener?.('loadingdone', this.onFonts);
    }

    _dirty(record) {
      if (this.destroyed || this.byNode.get(record.node) !== record) return;
      record.revision++;
      record.dirty = true;
      record.retryAt = 0;
      this.options.onDirty?.(record);
    }

    _watch(record) {
      const node = record.node;
      if (typeof MutationObserver !== 'undefined') {
        record.observer = new MutationObserver(changes => {
          const relevant = changes.some(change => {
            if (ignored(change.target)) return false;
            if (change.type === 'childList') {
              const changed = [...(change.addedNodes || []), ...(change.removedNodes || [])];
              return !changed.length || changed.some(n => !ignored(n));
            }
            if (change.type !== 'attributes') return true;
            if (change.attributeName === 'style') {
              const root = change.target === node;
              return styleIdentity(change.oldValue, root) !== styleIdentity(change.target.getAttribute('style'), root);
            }
            return !/^data-(?:glass|texture|frame|vf-motion)/.test(change.attributeName || '');
          });
          if (relevant) this._dirty(record);
        });
        record.observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true });
      }
      if (typeof ResizeObserver !== 'undefined') {
        record.resizeObserver = new ResizeObserver(() => {
          const w = Number(node.offsetWidth) || 1, h = Number(node.offsetHeight) || 1;
          if (Math.abs(w - record.width) > .5 || Math.abs(h - record.height) > .5) this._dirty(record);
        });
        record.resizeObserver.observe(node);
      }
      record.inputListener = event => { if (!ignored(event.target)) this._dirty(record); };
      record.scrollListener = event => {
        if (ignored(event.target)) return;
        // Only scrolling inside this block invalidates its pixels. The outer
        // page's native scroll is represented by the compositor's geometry.
        if (event.target === node || node.contains?.(event.target)) {
          this.lastMotion = clock();
          this._dirty(record);
        }
      };
      node.addEventListener('input', record.inputListener, true);
      node.addEventListener('change', record.inputListener, true);
      node.addEventListener('scroll', record.scrollListener, { capture: true, passive: true });
      node.addEventListener('load', record.inputListener, true);
    }

    _release(record) {
      record.generation++;
      record.observer?.disconnect();
      record.resizeObserver?.disconnect();
      record.node.removeEventListener('input', record.inputListener, true);
      record.node.removeEventListener('change', record.inputListener, true);
      record.node.removeEventListener('scroll', record.scrollListener, true);
      record.node.removeEventListener('load', record.inputListener, true);
      if (record.texture) this.gl.deleteTexture(record.texture);
      record.texture = null;
    }

    sync(nodes) {
      if (this.destroyed) return [];
      const active = [...new Set(nodes)].filter(n => n && !ignored(n));
      const wanted = new Set(active);
      for (const [node, record] of this.byNode) if (!wanted.has(node)) {
        this._release(record);
        this.byNode.delete(node);
      }
      const requested = active.map(node => {
        const w = Math.max(1, Number(node.offsetWidth) || 1), h = Math.max(1, Number(node.offsetHeight) || 1);
        const scale = Math.min(window.devicePixelRatio || 1, 1.5, this.maxSide / w, this.maxSide / h);
        return { node, w, h, scale };
      });
      const pixels = requested.reduce((sum, n) => sum + Math.ceil(n.w * n.scale) * Math.ceil(n.h * n.scale), 0);
      const budgetScale = pixels > this.maxPixels ? Math.sqrt(this.maxPixels / pixels) : 1;
      this.records = requested.map(({ node, w, h, scale }) => {
        let record = this.byNode.get(node);
        if (!record) {
          record = { node, texture: null, width: w, height: h, scale: 0, pixelWidth: 0, pixelHeight: 0, ready: false, version: 0, revision: 1, capturedRevision: 0, generation: 0, dirty: true, retryAt: 0, attempts: 0, lastError: '', styleKey: '' };
          this.byNode.set(node, record);
          this._watch(record);
        }
        scale *= budgetScale;
        const pw = clamp(Math.ceil(w * scale), 1, this.maxSide), ph = clamp(Math.ceil(h * scale), 1, this.maxSide);
        if (record.pixelWidth !== pw || record.pixelHeight !== ph || record.width !== w || record.height !== h) {
          record.width = w;
          record.height = h;
          record.scale = scale;
          record.pixelWidth = pw;
          record.pixelHeight = ph;
          record.generation++;
          record.ready = false;
          this._dirty(record);
          this._allocate(record);
        }
        return record;
      });
      return this.records;
    }

    _textureState(action) {
      const gl = this.gl;
      const binding = gl.getParameter(gl.TEXTURE_BINDING_2D);
      const premultiplied = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
      const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
      try {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        action();
      } finally {
        gl.bindTexture(gl.TEXTURE_2D, binding);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplied);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
      }
    }

    _allocate(record) {
      const gl = this.gl;
      this._textureState(() => {
        if (!record.texture) record.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, record.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, record.pixelWidth, record.pixelHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      });
      this.stats.allocations++;
    }

    _frame() {
      if (!this.frame) {
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('tabindex', '-1');
        frame.setAttribute('sandbox', 'allow-same-origin');
        frame.className = 'vf-dom-texture-frame';
        frame.style.cssText = 'position:fixed;left:-100000px;top:0;border:0;opacity:0;pointer-events:none;z-index:-9999;';
        document.body.appendChild(frame);
        this.frame = frame;
        this.frameDocument = frame.contentDocument;
        this.frameDocument.open();
        this.frameDocument.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
        this.frameDocument.close();
      }
      const frame = this.frame, fd = this.frameDocument;
      frame.style.width = Math.max(1, window.innerWidth) + 'px';
      frame.style.height = Math.max(1, window.innerHeight) + 'px';
      if (this.copiedHeadRevision !== this.headRevision) {
        fd.head.replaceChildren();
        const base = fd.createElement('base');
        base.href = document.baseURI;
        fd.head.appendChild(base);
        document.head.querySelectorAll('style,link[rel="stylesheet"]').forEach(original => {
          const copy = fd.importNode(original, true);
          if (original.tagName === 'LINK') copy.href = original.href;
          fd.head.appendChild(copy);
        });
        const reset = fd.createElement('style');
        reset.textContent = 'html,body{min-height:0!important;height:auto!important;overflow:visible!important;overscroll-behavior:auto!important}body{margin:0!important;background:transparent!important}*,*::before,*::after{animation-play-state:paused!important;transition:none!important}';
        fd.head.appendChild(reset);
        this.copiedHeadRevision = this.headRevision;
      }
      fd.documentElement.className = document.documentElement.className;
      fd.documentElement.setAttribute('style', document.documentElement.getAttribute('style') || '');
      fd.body.className = document.body.className;
      fd.body.setAttribute('style', document.body.getAttribute('style') || '');
      fd.body.style.setProperty('background', 'transparent', 'important');
      fd.body.style.setProperty('margin', '0', 'important');
      fd.body.replaceChildren();
      return fd;
    }

    async _snapshot(record) {
      if (this.options.snapshot) return this.options.snapshot(record.node, record);
      const fd = this._frame(), node = record.node;
      const ancestors = [];
      for (let parent = node.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) ancestors.unshift(parent);
      let mount = fd.body;
      for (const ancestor of ancestors) {
        const copy = fd.importNode(ancestor, false);
        for (const key of ['transform', 'translate', 'scale', 'rotate', 'filter', 'perspective']) copy.style.setProperty(key, 'none', 'important');
        copy.style.setProperty('opacity', '1', 'important');
        copy.style.setProperty('width', Math.max(1, ancestor.offsetWidth) + 'px', 'important');
        copy.style.setProperty('max-width', 'none', 'important');
        copy.style.setProperty('overflow', 'visible', 'important');
        copy.style.setProperty('content-visibility', 'visible', 'important');
        mount.appendChild(copy);
        mount = copy;
      }
      const copy = fd.importNode(node, true);
      const originals = [node, ...node.querySelectorAll('*')];
      const copies = [copy, ...copy.querySelectorAll('*')];
      originals.forEach((original, index) => {
        const cloned = copies[index];
        if (!cloned) return;
        if (original.tagName === 'CANVAS') {
          try { cloned.getContext('2d')?.drawImage(original, 0, 0); } catch (_) { /* Tainted external images are deliberately not read. */ }
        }
        if ('value' in original && 'value' in cloned) cloned.value = original.value;
        if ('checked' in original && 'checked' in cloned) cloned.checked = original.checked;
        if ('selected' in original && 'selected' in cloned) cloned.selected = original.selected;
        if (original.scrollTop) cloned.scrollTop = original.scrollTop;
        if (original.scrollLeft) cloned.scrollLeft = original.scrollLeft;
      });
      copy.querySelectorAll(EXCLUDED).forEach(n => n.remove());
      for (const key of ['transform', 'translate', 'scale', 'rotate', 'filter']) copy.style.setProperty(key, 'none', 'important');
      copy.style.setProperty('opacity', '1', 'important');
      copy.style.setProperty('box-sizing', 'border-box', 'important');
      copy.style.setProperty('width', record.width + 'px', 'important');
      copy.style.setProperty('height', record.height + 'px', 'important');
      copy.style.setProperty('min-width', '0', 'important');
      copy.style.setProperty('max-width', 'none', 'important');
      copy.style.setProperty('min-height', '0', 'important');
      copy.style.setProperty('max-height', 'none', 'important');
      copy.style.setProperty('margin', '0', 'important');
      copy.style.setProperty('content-visibility', 'visible', 'important');
      mount.appendChild(copy);
      // Preserve inherited custom properties even when the active scene has
      // inline CSS variables on a containing screen or preview environment.
      const inherited = getComputedStyle(node);
      for (let i = 0; i < inherited.length; i++) {
        const name = inherited[i];
        if (name.startsWith('--')) copy.style.setProperty(name, inherited.getPropertyValue(name));
      }
      if (fd.fonts?.ready) await Promise.race([fd.fonts.ready, new Promise(resolve => setTimeout(resolve, 500))]);
      return { node: copy, cleanup: () => fd.body.replaceChildren() };
    }

    pump(now = clock(), { moving = false } = {}) {
      if (this.destroyed || this.pending) return false;
      if (moving) this.lastMotion = now;
      const capture = this.options.capture || window.html2canvas;
      if (typeof capture !== 'function') return false;
      const candidates = this.records.filter(record => record.dirty && now >= record.retryAt);
      // Bootstrap still works when a perpetual ticker is moving, but changed
      // blocks wait until gestures and scene transitions have been idle.
      const record = candidates.find(r => !r.ready) || (!moving && now - this.lastMotion >= 150 ? candidates[0] : null);
      if (!record) return false;
      const revision = record.revision, generation = record.generation, started = clock();
      let snapshot;
      this.pending = Promise.resolve().then(async () => {
        snapshot = await this._snapshot(record);
        const source = snapshot?.node || snapshot;
        const canvas = await capture(source, {
          backgroundColor: null, logging: false, useCORS: true, allowTaint: false,
          foreignObjectRendering: false, imageTimeout: 3000, scale: record.scale,
          width: record.width, height: record.height, scrollX: 0, scrollY: 0,
          windowWidth: Math.max(1, window.innerWidth), windowHeight: Math.max(1, window.innerHeight),
          ignoreElements: ignored
        });
        if (this.destroyed || this.byNode.get(record.node) !== record || record.generation !== generation) return false;
        if (canvas.width !== record.pixelWidth || canvas.height !== record.pixelHeight) {
          // html2canvas rounds dimensions differently on fractional device
          // scales; fit to the allocated store, never upload out of bounds.
          const fitted = document.createElement('canvas');
          fitted.width = record.pixelWidth;
          fitted.height = record.pixelHeight;
          fitted.getContext('2d').drawImage(canvas, 0, 0, fitted.width, fitted.height);
          this._upload(record, fitted);
        } else this._upload(record, canvas);
        record.ready = true;
        record.version = ++this.serial;
        record.capturedRevision = revision;
        record.dirty = record.revision !== revision;
        record.attempts = 0;
        record.retryAt = 0;
        record.lastError = '';
        this.stats.captures++;
        this.stats.lastCaptureMs = clock() - started;
        this.options.onDirty?.(record);
        return true;
      }).catch(error => {
        if (this.destroyed || this.byNode.get(record.node) !== record) return false;
        record.dirty = true;
        record.attempts++;
        record.retryAt = now + Math.min(10000, 1000 * Math.pow(2, record.attempts - 1));
        record.lastError = String(error?.message || error);
        if (this.stats.errors.length < 20) this.stats.errors.push(record.lastError);
        this.options.onError?.(record.lastError, record);
        return false;
      }).finally(() => {
        snapshot?.cleanup?.();
        this.pending = null;
      });
      return true;
    }

    _upload(record, canvas) {
      this._textureState(() => {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, record.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      });
      this.stats.uploads++;
    }

    refresh(node) {
      if (node) { const record = this.byNode.get(node); if (record) this._dirty(record); }
      else for (const record of this.records) this._dirty(record);
    }

    diagnostics() {
      return {
        ...this.stats, errors: this.stats.errors.slice(), busy: !!this.pending,
        textureBytes: this.records.reduce((sum, r) => sum + r.pixelWidth * r.pixelHeight * 4, 0),
        records: this.records.map(r => ({ element: r.node.id || r.node.className, width: r.width, height: r.height, scale: r.scale, pixelWidth: r.pixelWidth, pixelHeight: r.pixelHeight, ready: r.ready, version: r.version, revision: r.revision, capturedRevision: r.capturedRevision, dirty: r.dirty, retryAt: r.retryAt, lastError: r.lastError }))
      };
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const record of this.records) this._release(record);
      this.records = [];
      this.byNode.clear();
      this.headObserver?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', this.onFonts);
      this.frame?.remove();
      this.frame = null;
      this.frameDocument = null;
    }
  }
  window.VFDomTextureCache = VFDomTextureCache;
})();
