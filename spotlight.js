import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PointerWatcher from 'resource:///org/gnome/shell/ui/pointerWatcher.js';


const POINTER_POLL_RATE_MS = 1000 / 60;
const SPOTLIGHT_DIAMETER_FRACTION = 0.32;
const IDLE_TIMEOUT_MS = 1000;


class _Spotlight {
    constructor(monitor) {
        this._monitor = monitor;
        this._widget = new St.Widget({
            visible: false,
            clip_to_allocation: true,
        });
        this._widget.set_size(monitor.width, monitor.height);
        this._widget.set_position(monitor.x, monitor.y);
        
        // A ring that covers the entire extent of all screens, implemented as a border:
        this._innerRadius = (monitor.height * SPOTLIGHT_DIAMETER_FRACTION) / 2;
        this._outerRadius = Math.sqrt(global.screen_width**2 + global.screen_height**2);
        
        this._overlay = new St.Widget({
            style_class: 'spotlight-overlay',
        });
        this._overlay.set_size(2 * this._outerRadius, 2 * this._outerRadius);
        this._overlay.set_style(`
            border-radius: ${this._outerRadius}px;
            border: ${this._outerRadius - this._innerRadius}px solid rgba(0, 0, 0, 0.35);
            background-color: rgba(0, 0, 0, 0);
        `);
        
        this._widget.add_child(this._overlay);
        global.stage.add_child(this._widget);

        this._widget.connect('destroy', () => {this._widget = null});
        this._overlay.connect('destroy', () => {this._overlay = null});

        this._pointer_watcher = PointerWatcher.getPointerWatcher();
        this._pointer_watch = null;
        this._idle_monitor = global.backend.get_core_idle_monitor();
        this._idle_watch = null;
    }

    enable() {
        if (!this._widget) {
            return;
        }
        this._pointerWatch = this._pointer_watcher.addWatch(POINTER_POLL_RATE_MS, this._update_position.bind(this));
        this._idle_watch = this._idle_monitor.add_idle_watch(IDLE_TIMEOUT_MS, this._on_idle.bind(this));
        const [x, y] = global.get_pointer();
        this._update_position(x, y);
        this._widget.show();
    }

    _on_idle() {
        if (this._widget.visible) {
            this._widget.visible = false;
        }
    }
    
    _update_position(x, y) {
        if (!this._overlay || !this._widget) {
            return;
        }
        // Center the spotlight on the cursor:
        this._overlay.set_position(x - this._monitor.x - this._outerRadius, y - this._monitor.y - this._outerRadius);
        if (!this._widget.visible) {
            this._widget.visible = true;
        }
    }

    disable() {
        if (this._widget) {
            this._widget.hide();
        }
        if (this._pointerWatch) {
            this._pointerWatch.remove();
        }
        this._pointerWatch = null;
        if (this._idle_watch) {
            this._idle_monitor.remove_watch(this._idle_watch);
        }
        this._idle_watch = null
    }

    set_enabled(enabled) {
        if (enabled) {
            this.enable();
        } else {
            this.disable();
        }
    }

    destroy() {
        this.disable();
        if (this._overlay) {
            this._overlay.destroy();
        }
        if (this._widget) {
            global.stage.remove_child(this._widget);
            this._widget.destroy();
        }
    }
}

export class Spotlight {
    constructor() {
        this._spotlights = [];
        this._enabled = false;
        this._createSpotlights();
        
        // Listen for monitor changes
        this._monitorChangedId = Main.layoutManager.connect('monitors-changed', () => {
            this._recreateSpotlights();
        });
    }
    
    _createSpotlights() {
        // Create a spotlight for each monitor
        for (let monitor of Main.layoutManager.monitors) {
            let spotlight = new _Spotlight(monitor);
            this._spotlights.push(spotlight);
        }
    }
    
    _recreateSpotlights() {
        // Destroy existing spotlights
        for (let spotlight of this._spotlights) {
            spotlight.destroy();
        }
        this._spotlights = [];
        
        // Create new spotlights
        this._createSpotlights();
        
        // Restore enable state
        if (this._enabled) {
            this._set_all_enabled(true);
        }
    }
    
    _set_all_enabled(enabled) {
        for (let spotlight of this._spotlights) {
            spotlight.set_enabled(enabled);
        }
    }
    
    enable() {
        this._enabled = true;
        this._set_all_enabled(true);
    }
    
    disable() {
        this._enabled = false;
        this._set_all_enabled(false);
    }
    
    set_enabled(enabled) {
        if (enabled) {
            this.enable();
        } else {
            this.disable();
        }
    }
    
    destroy() {
        this.disable();
        
        // Disconnect monitor change handler
        if (this._monitorChangedId) {
            Main.layoutManager.disconnect(this._monitorChangedId);
        }
        
        // Destroy all spotlights
        for (let spotlight of this._spotlights) {
            spotlight.destroy();
        }
        this._spotlights = [];
    }
}
