import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SPOTLIGHT_DIAMETER_FRACTION = 0.32;
const SPOTLIGHT_BORDER_WIDTH = 8;

class _Spotlight {
    constructor(monitor) {
        this._monitor = monitor;
        this._container = new St.Widget({
            visible: false,
            clip_to_allocation: true,
        });
        this._container.set_size(monitor.width, monitor.height);
        this._container.set_position(monitor.x, monitor.y);
        
        // A ring that covers the entire extent of all screens, implemented as a border:
        this._innerRadius = (monitor.height * SPOTLIGHT_DIAMETER_FRACTION) / 2;
        this._outerRadius = Math.sqrt(global.screen_width**2 + global.screen_height**2);
        let borderThickness = this._outerRadius - this._innerRadius;
        
        this._overlay = new St.Widget({
            style_class: 'spotlight-overlay',
        });
        this._overlay.set_size(2 * this._outerRadius, 2 * this._outerRadius);
        this._overlay.set_style(`
            border-radius: ${this._outerRadius}px;
            border: ${borderThickness}px solid rgba(0, 0, 0, 0.35);
            background-color: rgba(0, 0, 0, 0);
        `);
        
        // Create the green border
        let borderSize = (this._innerRadius + SPOTLIGHT_BORDER_WIDTH) * 2;
        this._border = new St.Widget({
            style_class: 'spotlight-border',
        });
        this._border.set_size(borderSize, borderSize);
        this._border.set_style(`
            border-radius: ${this._innerRadius + SPOTLIGHT_BORDER_WIDTH}px;
            border: ${SPOTLIGHT_BORDER_WIDTH}px solid rgba(0, 255, 0, 0.5);
            background-color: rgba(0, 0, 0, 0);
        `);
        
        this._container.add_child(this._overlay);
        this._container.add_child(this._border);
        global.stage.add_child(this._container);
        this._callbackId = null;
        this._laters = global.compositor.get_laters();

        this._container.connect('destroy', () => {this._container = null});
        this._overlay.connect('destroy', () => {this._overlay = null});
        this._border.connect('destroy', () => {this._border = null});
    }

    _schedule_update() {
        if (this._callbackId) {
            return;
        }
        this._callbackId = this._laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._updatePosition();
            this._callbackId = null;
            this._schedule_update(); // next frame
        });
    }

    show() {
        if (!this._container) {
            return;
        }
        this._updatePosition();
        this._container.show();
        this._schedule_update();
    }

    _updatePosition() {
        if (!this._overlay || !this._border  || !this._container) {
            return;
        }
        // Update spotlight position to follow cursor
        let [x, y] = global.get_pointer();
        
        // Center the spotlight on the cursor (relative to monitor)
        this._overlay.set_position(x - this._monitor.x - this._outerRadius, y - this._monitor.y - this._outerRadius);
        
        // Position the border (relative to monitor)
        let borderOffset = this._innerRadius + SPOTLIGHT_BORDER_WIDTH;
        this._border.set_position(x - this._monitor.x - borderOffset, y - this._monitor.y - borderOffset);
    }

    hide() {
        if (this._container) {
            this._container.hide();
        }
        if (this._callbackId) {
            this._laters.remove(this._callbackId);
            this._callbackId = null;
        }
    }

    set_visible(visible) {
        if (visible) {
            this.show();
        } else {
            this.hide();
        }
    }

    destroy() {
        this.hide();
        if (this._border) {
            this._border.destroy();
        }
        if (this._overlay) {
            this._overlay.destroy();
        }
        if (this._container) {
            global.stage.remove_child(this._container);
            this._container.destroy();
        }
    }
}

export class Spotlight {
    constructor() {
        this._spotlights = [];
        this._visible = false;
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
        
        // Restore visibility state
        if (this._visible) {
            this._setAllVisible(true);
        }
    }
    
    _setAllVisible(visible) {
        for (let spotlight of this._spotlights) {
            spotlight.set_visible(visible);
        }
    }
    
    show() {
        this._visible = true;
        this._setAllVisible(true);
    }
    
    hide() {
        this._visible = false;
        this._setAllVisible(false);
    }
    
    set_visible(visible) {
        if (visible) {
            this.show();
        } else {
            this.hide();
        }
    }
    
    destroy() {
        this.hide();
        
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
