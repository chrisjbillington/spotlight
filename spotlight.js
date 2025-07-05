import Meta from 'gi://Meta';
import St from 'gi://St';

const SPOTLIGHT_DIAMETER_FRACTION = 0.32;
const SPOTLIGHT_BORDER_WIDTH = 8;

export class Spotlight {
    constructor() {
        this._container = new St.Widget({
            visible: false,
        });
        this._container.set_size(global.screen_width, global.screen_height);
        this._container.set_position(0, 0);
        
        // Create a massive ring that covers the entire screen
        this._spotlightRadius = (global.screen_height * SPOTLIGHT_DIAMETER_FRACTION) / 2;
        this._overlayRadius = Math.sqrt(global.screen_width**2 + global.screen_height**2);
        let borderThickness = this._overlayRadius - this._spotlightRadius;
        
        this._overlay = new St.Widget({
            style_class: 'spotlight-overlay',
        });
        this._overlay.set_size(2 * this._overlayRadius, 2 * this._overlayRadius);
        this._overlay.set_style(`
            border-radius: ${this._overlayRadius}px;
            border: ${borderThickness}px solid rgba(0, 0, 0, 0.35);
            background-color: rgba(0, 0, 0, 0);
        `);
        
        // Create the green border
        let borderSize = (this._spotlightRadius + SPOTLIGHT_BORDER_WIDTH) * 2;
        this._border = new St.Widget({
            style_class: 'spotlight-border',
        });
        this._border.set_size(borderSize, borderSize);
        this._border.set_style(`
            border-radius: ${this._spotlightRadius + SPOTLIGHT_BORDER_WIDTH}px;
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
        
        // Center the spotlight on the cursor
        this._overlay.set_position(x - this._overlayRadius, y - this._overlayRadius);
        
        // Position the border
        let borderOffset = this._spotlightRadius + SPOTLIGHT_BORDER_WIDTH;
        this._border.set_position(x - borderOffset, y - borderOffset);
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
