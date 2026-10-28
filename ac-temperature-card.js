/* AC Temperature Card - a single sleek card to control a climate entity's target temperature */
const CARD_VERSION = "0.1.0";

const MODE_COLORS = {
  cool: "#2196f3",
  heat: "#ff7043",
  auto: "#26a69a",
  dry: "#ffb300",
  fan_only: "#8bc34a",
  heat_cool: "#26a69a",
};

class AcTemperatureCard extends HTMLElement {
  static getStubConfig(hass) {
    const e = Object.keys(hass.states).find((id) => id.startsWith("climate."));
    return { entity: e || "climate.living_room_air_conditioner" };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
        { name: "name", selector: { text: {} } },
        { name: "step", selector: { number: { min: 0.1, max: 5, step: 0.1, mode: "box" } } },
        { name: "show_current", selector: { boolean: {} } },
        { name: "color", selector: { text: {} } },
      ],
      computeLabel: (s) =>
        ({
          entity: "Climate entity",
          name: "Label (optional)",
          step: "Step (default: entity's target_temp_step or 1)",
          show_current: "Show current room temperature",
          color: "Accent color override (e.g. #2196f3)",
        }[s.name] || s.name),
    };
  }

  setConfig(config) {
    if (!config.entity) throw new Error("You need to define an entity");
    this._config = { show_current: true, ...config };
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          ha-card {
            display: flex; align-items: center; justify-content: space-between;
            height: 100%; min-height: 84px; padding: 8px 12px; box-sizing: border-box;
            border: none; overflow: hidden;
            --accent: var(--primary-color);
          }
          button {
            all: unset; box-sizing: border-box; cursor: pointer;
            width: 56px; height: 56px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: var(--secondary-text-color);
            --mdc-icon-size: 28px;
            transition: background-color .2s, color .2s, transform .1s;
            -webkit-tap-highlight-color: transparent;
          }
          button:hover { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
          button:active { transform: scale(.9); }
          button:focus-visible { outline: 2px solid var(--accent); }
          button[disabled] { opacity: .3; pointer-events: none; }
          .center {
            flex: 1; display: flex; flex-direction: column; align-items: center;
            justify-content: center; cursor: pointer; user-select: none; min-width: 0;
          }
          .temp { display: flex; align-items: flex-start; line-height: 1; }
          .value {
            font-size: 2.6rem; font-weight: 300; letter-spacing: -1px;
            color: var(--primary-text-color); transition: color .3s;
            font-variant-numeric: tabular-nums;
          }
          .unit {
            font-size: 1.1rem; font-weight: 400; margin: 6px 0 0 3px;
            color: var(--accent); opacity: .9;
          }
          .sub {
            margin-top: 4px; font-size: .75rem; letter-spacing: .5px;
            color: var(--secondary-text-color); text-transform: uppercase;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
          }
          .off .value { color: var(--secondary-text-color); opacity: .6; }
        </style>
        <ha-card>
          <button id="down" aria-label="Decrease"><ha-icon icon="mdi:minus"></ha-icon></button>
          <div class="center" id="center">
            <div class="temp"><span class="value" id="value">--</span><span class="unit" id="unit"></span></div>
            <div class="sub" id="sub"></div>
          </div>
          <button id="up" aria-label="Increase"><ha-icon icon="mdi:plus"></ha-icon></button>
        </ha-card>`;
      const $ = (id) => this.shadowRoot.getElementById(id);
      this._els = { card: this.shadowRoot.querySelector("ha-card"), down: $("down"), up: $("up"), center: $("center"), value: $("value"), unit: $("unit"), sub: $("sub") };
      this._els.down.addEventListener("click", () => this._bump(-1));
      this._els.up.addEventListener("click", () => this._bump(1));
      this._els.center.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._config.entity } }));
      });
    }
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() { return 1; }
  getGridOptions() { return { columns: 6, rows: 1, min_columns: 3, min_rows: 1 }; }

  _stateObj() { return this._hass && this._hass.states[this._config.entity]; }

  _step(stateObj) {
    return Number(this._config.step) || Number(stateObj?.attributes.target_temp_step) || 1;
  }

  _decimals(step) {
    const s = String(step);
    return s.includes(".") ? s.split(".")[1].length : 0;
  }

  _bump(dir) {
    const st = this._stateObj();
    if (!st) return;
    const a = st.attributes;
    const step = this._step(st);
    const base = this._pending ?? Number(a.temperature);
    if (isNaN(base)) return;
    const min = a.min_temp ?? 16, max = a.max_temp ?? 32;
    let next = Math.min(max, Math.max(min, base + dir * step));
    next = Number(next.toFixed(this._decimals(step)));
    this._pending = next;
    this._update();
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._hass.callService("climate", "set_temperature", { entity_id: this._config.entity, temperature: next });
      clearTimeout(this._release);
      this._release = setTimeout(() => { this._pending = null; this._update(); }, 4000);
    }, 600); // debounce: rapid taps send one command
  }

  _update() {
    if (!this._els || !this._hass) return;
    const st = this._stateObj();
    const e = this._els;
    if (!st) { e.value.textContent = "?"; e.sub.textContent = "Entity not found"; return; }
    const a = st.attributes;
    const target = Number(a.temperature);
    if (this._pending !== null && target === this._pending) this._pending = null;

    const unavailable = st.state === "unavailable" || st.state === "unknown";
    const isOff = st.state === "off";
    const step = this._step(st);
    const shown = this._pending ?? target;

    e.value.textContent = isNaN(shown) ? "--" : shown.toFixed(this._decimals(step));
    e.unit.textContent = this._hass.config?.unit_system?.temperature || "°C";
    e.card.classList.toggle("off", isOff || unavailable);
    e.down.disabled = e.up.disabled = unavailable || isOff || isNaN(shown);

    const accent = this._config.color || (isOff ? "var(--secondary-text-color)" : MODE_COLORS[st.state] || "var(--primary-color)");
    e.card.style.setProperty("--accent", accent);

    const parts = [];
    if (this._config.name) parts.push(this._config.name);
    if (isOff) parts.push("Off");
    else if (this._config.show_current && a.current_temperature != null) parts.push(`Now ${a.current_temperature}°`);
    e.sub.textContent = parts.join(" · ");
    e.sub.style.display = parts.length ? "" : "none";
  }
}

customElements.define("ac-temperature-card", AcTemperatureCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "ac-temperature-card",
  name: "AC Temperature Card",
  description: "Sleek −/+ target temperature control for a climate entity",
  preview: true,
});
console.info(`%c AC-TEMPERATURE-CARD %c v${CARD_VERSION} `, "background:#2196f3;color:#fff;font-weight:bold", "background:#333;color:#fff");
