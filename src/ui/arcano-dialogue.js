// arcano-dialogue.js
// Drop-in vanilla-JS dialogue UI overlay for a Three.js game.
// No dependencies. Lives as a DOM overlay above your <canvas>.

(function () {
  'use strict';

  const STYLES = `
  .arc-root, .arc-root * { box-sizing: border-box; }
  .arc-root {
    position: fixed; inset: 0; z-index: 9999;
    pointer-events: none;
    font-family: "Cormorant Garamond", "Garamond", "EB Garamond", serif;
    color: #ece6ff;
  }
  .arc-root[data-open="1"] { pointer-events: auto; }

  .arc-veil {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 90% 60% at 50% 110%, rgba(40,28,92,0.45) 0%, rgba(8,5,24,0.0) 60%),
      radial-gradient(ellipse 80% 50% at 50% 0%,   rgba(60,40,120,0.25) 0%, rgba(8,5,24,0.0) 60%);
    opacity: 0; transition: opacity .35s ease;
    pointer-events: none;
  }
  .arc-root[data-open="1"] .arc-veil { opacity: 1; }

  .arc-hist-btn {
    position: absolute; top: 18px; right: 20px;
    background: rgba(16, 9, 42, 0.78);
    border: 1px solid rgba(133, 118, 216, 0.45);
    border-radius: 8px; padding: 7px 11px;
    color: #ece6ff; font-family: inherit; font-size: 13px;
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    backdrop-filter: blur(8px);
    opacity: 0; transform: translateY(-6px);
    transition: opacity .25s ease, transform .25s ease, background .15s, border-color .15s;
  }
  .arc-root[data-open="1"] .arc-hist-btn { opacity: 1; transform: none; }
  .arc-hist-btn:hover { background: rgba(40, 28, 92, 0.95); border-color: #c4b3ff; }

  .arc-dock {
    position: absolute; left: 0; right: 0; bottom: 0;
    padding: 0 max(24px, 4vw) max(20px, 3vh);
    transform: translateY(20px); opacity: 0;
    transition: transform .3s cubic-bezier(.2,.7,.3,1), opacity .3s ease;
  }
  .arc-root[data-open="1"] .arc-dock { transform: none; opacity: 1; }

  .arc-nameplate-wrap {
    max-width: 1100px; margin: 0 auto;
  }
  .arc-nameplate {
    display: inline-flex; align-items: baseline; gap: 8px;
    background: #1a1244;
    border: 1px solid #8576d8; border-bottom: none;
    padding: 7px 18px 6px;
    border-top-left-radius: 8px; border-top-right-radius: 8px;
    margin-left: 0; position: relative; top: 1px;
  }
  .arc-name {
    font-family: "Cormorant SC", "Cormorant Garamond", serif;
    font-size: 18px; color: #dccfff; letter-spacing: 0.08em;
  }
  .arc-title {
    font-size: 12px; color: rgba(220, 207, 255, 0.6);
    font-style: italic;
  }

  .arc-panel {
    position: relative;
    background: #10092a;
    border: 1.5px solid #5a4ba8;
    border-radius: 10px;
    padding: 18px 22px;
    display: flex; gap: 18px; align-items: flex-start;
    cursor: pointer;
    box-shadow:
      0 -20px 80px rgba(40, 20, 100, 0.5),
      0 0 0 1px rgba(0,0,0,.5),
      inset 0 1px 0 rgba(180, 160, 255, 0.08);
    min-height: 140px;
    max-width: 1100px; margin: 0 auto;
  }

  .arc-corner { position: absolute; width: 22px; height: 22px; opacity: 0.75; pointer-events: none; }
  .arc-corner.tl { top: 8px; left: 8px; }
  .arc-corner.tr { top: 8px; right: 8px; transform: scaleX(-1); }
  .arc-corner.bl { bottom: 8px; left: 8px; transform: scaleY(-1); }
  .arc-corner.br { bottom: 8px; right: 8px; transform: scale(-1, -1); }

  .arc-portrait {
    flex-shrink: 0;
    width: 96px; height: 96px;
    border-radius: 8px;
    border: 2px solid #8576d8;
    box-shadow: inset 0 -10px 24px rgba(0,0,0,.35), inset 0 4px 14px rgba(255,255,255,.12);
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
    background-size: cover; background-position: center;
  }
  .arc-portrait::after {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.4) 100%);
    pointer-events: none;
  }
  .arc-portrait-mono {
    font-family: "Cormorant SC", "Cormorant Garamond", serif;
    font-size: 42px; color: #dccfff;
    text-shadow: 0 2px 8px rgba(0,0,0,.5);
    letter-spacing: 0.02em; line-height: 1;
    position: relative; z-index: 1;
  }

  .arc-content { flex: 1; min-width: 0; }

  .arc-text {
    font-size: 17px; line-height: 1.55;
    color: #ece6ff;
  }
  .arc-text > span {
    opacity: 0;
    transition: opacity .18s ease-out;
  }
  .arc-text > span.on { opacity: 1; }

  .arc-cursor {
    display: inline-block; margin-left: 8px;
    color: #c4b3ff;
    animation: arc-blink 1s infinite steps(1);
  }
  @keyframes arc-blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  .arc-choices {
    display: flex; flex-direction: column; gap: 6px;
    margin-top: 14px;
    opacity: 0; transform: translateY(4px);
    transition: opacity .25s ease, transform .25s ease;
    pointer-events: none;
  }
  .arc-choices.on { opacity: 1; transform: none; pointer-events: auto; }
  .arc-choice {
    background: rgba(26, 18, 68, 0.7);
    border: 1px solid rgba(133, 118, 216, 0.45);
    border-radius: 6px;
    padding: 9px 14px;
    text-align: left; color: #dccfff;
    font-family: inherit; font-size: 14px;
    cursor: pointer;
    transition: background .12s, border-color .12s, transform .12s;
    display: flex; align-items: center; gap: 10px;
  }
  .arc-choice:hover {
    background: rgba(40, 28, 92, 0.95);
    border-color: #c4b3ff;
    transform: translateX(3px);
  }
  .arc-choice-arrow {
    color: #c4b3ff;
    font-family: "Cormorant SC", serif;
  }

  .arc-history-btn-wrap { position: absolute; top: 18px; right: 20px; }
  .arc-history-btn-wrap .arc-hist-btn { position: static; }

  .arc-history-drop {
    position: absolute; top: calc(100% + 6px); right: 0;
    width: 340px; max-height: 380px;
    background: rgba(8, 5, 24, 0.96);
    border: 1px solid #5a4ba8;
    border-radius: 10px;
    box-shadow:
      0 14px 40px rgba(0,0,0,.55),
      0 0 0 1px rgba(180, 160, 255, 0.06),
      inset 0 1px 0 rgba(180, 160, 255, 0.06);
    display: flex; flex-direction: column;
    opacity: 0; transform: translateY(-6px) scale(.98);
    transform-origin: top right;
    pointer-events: none;
    transition: opacity .18s ease, transform .18s cubic-bezier(.2,.7,.3,1);
    overflow: hidden;
  }
  .arc-history-drop.on { opacity: 1; transform: none; pointer-events: auto; }
  .arc-history-drop::before {
    content: ''; position: absolute; top: -6px; right: 22px;
    width: 10px; height: 10px;
    background: rgba(8, 5, 24, 0.96);
    border-top: 1px solid #5a4ba8;
    border-left: 1px solid #5a4ba8;
    transform: rotate(45deg);
  }

  .arc-history-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 12px 9px 14px;
    border-bottom: 1px solid rgba(133, 118, 216, 0.35);
    background: rgba(26, 18, 68, 0.55);
  }
  .arc-history-title {
    font-family: "Cormorant SC", serif;
    font-size: 13px; color: #dccfff;
    letter-spacing: 0.14em; text-transform: uppercase;
  }
  .arc-history-count {
    font-size: 11px; color: rgba(220, 207, 255, 0.5);
    font-variant-numeric: tabular-nums;
  }

  .arc-history-body {
    overflow-y: auto; padding: 10px 14px 12px; min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(133, 118, 216, .4) transparent;
  }
  .arc-history-body::-webkit-scrollbar { width: 6px; }
  .arc-history-body::-webkit-scrollbar-thumb {
    background: rgba(133, 118, 216, .35); border-radius: 3px;
  }
  .arc-history-body::-webkit-scrollbar-thumb:hover {
    background: rgba(133, 118, 216, .55);
  }

  .arc-history-line { margin: 0 0 9px; font-size: 13px; line-height: 1.5; }
  .arc-history-line:last-child { margin-bottom: 0; }
  .arc-history-line .arc-history-name {
    font-family: "Cormorant SC", serif;
    color: #c4b3ff; margin-right: 6px;
    font-size: 12px; letter-spacing: 0.04em;
  }
  .arc-history-npc-text { color: #ece6ff; }
  .arc-history-player {
    color: rgba(236, 230, 255, 0.55);
    padding-left: 10px;
    border-left: 2px solid #c4b3ff;
    font-style: italic; font-size: 12.5px;
  }
  .arc-history-empty {
    color: rgba(236, 230, 255, 0.45);
    font-style: italic; font-size: 12.5px;
    text-align: center; padding: 24px 8px;
  }

  .arc-hist-btn[data-on="1"] {
    background: rgba(40, 28, 92, 0.95);
    border-color: #c4b3ff;
  }
  `;

  const CORNER_SVG =
    '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 2 L2 8 M2 2 L8 2 M2 2 Q6 4 8 8" fill="none" stroke="#c4b3ff" stroke-width="1" stroke-linecap="round"/>' +
      '<circle cx="2" cy="2" r="1.2" fill="#c4b3ff"/>' +
    '</svg>';

  function injectStyles() {
    if (document.getElementById('arc-dlg-styles')) return;
    const s = document.createElement('style');
    s.id = 'arc-dlg-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  class ArcanoDialogue {
    constructor(opts = {}) {
      injectStyles();
      this.opts = Object.assign({
        mount: document.body,
        wordDelay: 38,
        onOpen: null,
        onClose: null,
      }, opts);

      this.npcs = {};
      this.handlers = {};
      this.history = [];
      this._recorded = new Set();
      this.isOpen = false;
      this._currentId = null;
      this._currentNode = null;
      this._words = [];
      this._revealed = 0;
      this._done = false;
      this._typingTimer = null;
      this._historyOpen = false;

      this._buildDOM();
      this._bindKeys();
    }

    registerNPC(id, npc) {
      this.npcs[id] = npc;
      return this;
    }

    open(npcId, startNodeId) {
      const npc = this.npcs[npcId];
      if (!npc) { console.warn('[ArcanoDialogue] unknown NPC:', npcId); return; }
      this._currentId = npcId;
      this.isOpen = true;
      this.root.dataset.open = '1';
      this.history = [];
      this._recorded = new Set();
      this._renderNameplate(npc);
      this._renderPortrait(npc);
      this._goto(startNodeId || npc.start);
      this.opts.onOpen && this.opts.onOpen({ npcId });
      this._emit('open', { npcId });
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.root.dataset.open = '0';
      const id = this._currentId;
      this._currentId = null;
      this._currentNode = null;
      this._stopTyping();
      this._setHistoryOpen(false);
      this.opts.onClose && this.opts.onClose({ npcId: id });
      this._emit('close', { npcId: id });
    }

    on(event, handler) {
      (this.handlers[event] || (this.handlers[event] = [])).push(handler);
      return this;
    }

    destroy() {
      this._stopTyping();
      window.removeEventListener('keydown', this._onKey);
      this.root.remove();
    }

    _buildDOM() {
      this.root = el('div', 'arc-root');
      this.root.dataset.open = '0';

      this.root.appendChild(el('div', 'arc-veil'));

      this.histBtnWrap = el('div', 'arc-history-btn-wrap');
      this.histBtn = el('button', 'arc-hist-btn',
        '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 3h9M2 6.5h9M2 10h6"/></svg><span>Crónica</span>');
      this.histBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._setHistoryOpen(!this._historyOpen);
      });
      this.histBtnWrap.appendChild(this.histBtn);

      this.histDrop = el('div', 'arc-history-drop');
      this.histDrop.innerHTML =
        '<div class="arc-history-head">' +
          '<span class="arc-history-title">Crónica</span>' +
          '<span class="arc-history-count"></span>' +
        '</div>' +
        '<div class="arc-history-body"></div>';
      this.histDrop.addEventListener('click', (e) => e.stopPropagation());
      this.histBtnWrap.appendChild(this.histDrop);

      this.root.appendChild(this.histBtnWrap);

      this.dock = el('div', 'arc-dock');
      this.nameplate = el('div', 'arc-nameplate',
        '<span class="arc-name"></span><span class="arc-title"></span>');
      this.panel = el('div', 'arc-panel');
      this.panel.innerHTML =
        '<div class="arc-corner tl">' + CORNER_SVG + '</div>' +
        '<div class="arc-corner tr">' + CORNER_SVG + '</div>' +
        '<div class="arc-corner bl">' + CORNER_SVG + '</div>' +
        '<div class="arc-corner br">' + CORNER_SVG + '</div>';

      this.portraitEl = el('div', 'arc-portrait');
      this.portraitMono = el('div', 'arc-portrait-mono');
      this.portraitEl.appendChild(this.portraitMono);

      this.content = el('div', 'arc-content');
      this.textEl = el('div', 'arc-text');
      this.choicesEl = el('div', 'arc-choices');
      this.content.appendChild(this.textEl);
      this.content.appendChild(this.choicesEl);

      this.panel.appendChild(this.portraitEl);
      this.panel.appendChild(this.content);
      this.panel.addEventListener('click', (e) => {
        if (e.target.closest('.arc-choice')) return;
        this._advance();
      });

      const npWrap = el('div', 'arc-nameplate-wrap');
      npWrap.appendChild(this.nameplate);
      this.dock.appendChild(npWrap);
      this.dock.appendChild(this.panel);
      this.root.appendChild(this.dock);

      this.opts.mount.appendChild(this.root);
    }

    _bindKeys() {
      this._onKey = (e) => {
        if (!this.isOpen) return;
        if (this._historyOpen) {
          if (e.key === 'Escape') this._setHistoryOpen(false);
          return;
        }
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this._advance(); }
        else if (e.key === 'Escape') this.close();
        else if (e.key >= '1' && e.key <= '9') {
          const idx = parseInt(e.key, 10) - 1;
          const btns = this.choicesEl.querySelectorAll('.arc-choice');
          if (btns[idx]) btns[idx].click();
        }
      };
      window.addEventListener('keydown', this._onKey);
    }

    _renderNameplate(npc) {
      this.nameplate.querySelector('.arc-name').textContent = npc.name || '';
      this.nameplate.querySelector('.arc-title').textContent = npc.title || '';
    }

    _renderPortrait(npc) {
      if (npc.portraitUrl) {
        this.portraitEl.style.backgroundImage = `url("${npc.portraitUrl}")`;
        this.portraitMono.style.display = 'none';
      } else {
        const { hue = 260, secondHue = 220 } = npc.portrait || {};
        this.portraitEl.style.backgroundImage =
          `radial-gradient(circle at 35% 30%, hsl(${hue} 60% 55%) 0%, hsl(${secondHue} 55% 32%) 60%, #0a0820 100%)`;
        this.portraitMono.style.display = '';
        this.portraitMono.textContent = npc.mono || (npc.name || '?')[0].toUpperCase();
      }
    }

    _goto(nodeId) {
      const npc = this.npcs[this._currentId];
      const node = npc && npc.nodes[nodeId];
      if (!node) { this.close(); return; }
      this._currentNode = nodeId;

      const key = this._currentId + '/' + nodeId + '/' + this.history.length;
      if (!this._recorded.has(key)) {
        this._recorded.add(key);
        this.history.push({ kind: 'npc', name: npc.name, text: node.text });
        this._emit('line', { npcId: this._currentId, nodeId, text: node.text });
      }

      this.textEl.innerHTML = '';
      this.choicesEl.innerHTML = '';
      this.choicesEl.classList.remove('on');

      this._words = node.text.split(/(\s+)/);
      this._wordSpans = this._words.map((w) => {
        const span = document.createElement('span');
        span.textContent = w;
        this.textEl.appendChild(span);
        return span;
      });
      this._revealed = 0;
      this._done = false;
      this._stopTyping();
      this._typeNext();
    }

    _typeNext() {
      while (this._revealed < this._wordSpans.length) {
        const span = this._wordSpans[this._revealed];
        this._revealed++;
        span.classList.add('on');
        if (span.textContent.trim()) {
          this._typingTimer = setTimeout(() => this._typeNext(), this.opts.wordDelay);
          return;
        }
      }
      this._finishTyping();
    }

    _stopTyping() {
      if (this._typingTimer) { clearTimeout(this._typingTimer); this._typingTimer = null; }
    }

    _finishTyping() {
      this._stopTyping();
      this._wordSpans.forEach((s) => s.classList.add('on'));
      this._revealed = this._wordSpans.length;
      this._done = true;

      const npc = this.npcs[this._currentId];
      const node = npc.nodes[this._currentNode];

      if (node.choices && node.choices.length) {
        this._renderChoices(node.choices);
      } else if (node.next) {
        const cur = document.createElement('span');
        cur.className = 'arc-cursor on';
        cur.textContent = '▾';
        this.textEl.appendChild(cur);
      } else {
        const cur = document.createElement('span');
        cur.className = 'arc-cursor on';
        cur.textContent = '●';
        this.textEl.appendChild(cur);
      }
    }

    _renderChoices(choices) {
      this.choicesEl.innerHTML = '';
      choices.forEach((c, i) => {
        const btn = el('button', 'arc-choice');
        btn.innerHTML =
          '<span class="arc-choice-arrow">▸</span><span style="flex:1">' +
          c.label.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' +
          (i < 9 ? '<span style="opacity:.4;font-size:11px">' + (i + 1) + '</span>' : '');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.history.push({ kind: 'player', text: c.label });
          this._emit('choice', { npcId: this._currentId, nodeId: this._currentNode, choice: c });
          if (c.to === 'END' || !c.to) {
            const id = this._currentId;
            this.close();
            this._emit('end', { npcId: id });
          } else {
            this._goto(c.to);
          }
        });
        this.choicesEl.appendChild(btn);
      });
      requestAnimationFrame(() => this.choicesEl.classList.add('on'));
    }

    _advance() {
      if (!this._done) { this._finishTyping(); return; }
      const npc = this.npcs[this._currentId];
      const node = npc && npc.nodes[this._currentNode];
      if (!node) return;
      if (node.choices && node.choices.length) return;
      if (node.next) {
        this._goto(node.next);
      } else {
        const id = this._currentId;
        this.close();
        this._emit('end', { npcId: id });
      }
    }

    _setHistoryOpen(open) {
      this._historyOpen = open;
      this.histDrop.classList.toggle('on', open);
      this.histBtn.dataset.on = open ? '1' : '0';
      if (open) {
        this._renderHistory();
        this._outsideHandler = (e) => {
          if (!this.histBtnWrap.contains(e.target)) this._setHistoryOpen(false);
        };
        setTimeout(() => document.addEventListener('click', this._outsideHandler), 0);
      } else if (this._outsideHandler) {
        document.removeEventListener('click', this._outsideHandler);
        this._outsideHandler = null;
      }
    }

    _renderHistory() {
      const body  = this.histDrop.querySelector('.arc-history-body');
      const count = this.histDrop.querySelector('.arc-history-count');
      count.textContent = this.history.length
        ? this.history.length + (this.history.length === 1 ? ' linha' : ' linhas')
        : '';
      if (!this.history.length) {
        body.innerHTML = '<div class="arc-history-empty">Ainda não trocaste palavra.</div>';
        return;
      }
      body.innerHTML = this.history.map((h) => {
        const txt = String(h.text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        if (h.kind === 'npc') {
          return '<div class="arc-history-line"><span class="arc-history-name">' +
            String(h.name).replace(/&/g, '&amp;').replace(/</g, '&lt;') +
            '</span><span class="arc-history-npc-text">' + txt + '</span></div>';
        }
        return '<div class="arc-history-line"><div class="arc-history-player">Tu: ' + txt + '</div></div>';
      }).join('');
      body.scrollTop = body.scrollHeight;
    }

    _emit(event, payload) {
      (this.handlers[event] || []).forEach((h) => {
        try { h(payload); } catch (e) { console.error(e); }
      });
    }
  }

  if (typeof window !== 'undefined') window.ArcanoDialogue = ArcanoDialogue;
  if (typeof module !== 'undefined' && module.exports) module.exports = ArcanoDialogue;
})();

export default (typeof window !== 'undefined' ? window.ArcanoDialogue : null);
