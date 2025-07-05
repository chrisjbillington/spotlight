import Meta from 'gi://Meta';
import St from 'gi://St';

export class LaserPointer {
    constructor() {
        this._widget = new St.Widget({
            style_class: 'spotlight-laser',
            visible: false,
        });
        global.stage.add_child(this._widget);
        this._callbackId = null;
        this._laters = global.compositor.get_laters();
        this._widget.connect('destroy', () => {this._widget = null});
    }

    _schedule_update() {
        if (this._callbackId) {
            return;
        }
        this._callbackId = this._laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._moveToCursor();
            this._callbackId = null;
            this._schedule_update(); // next frame
        });
    }

    show() {
        if (!this._widget) {
            return;
        }
        this._moveToCursor();
        this._widget.show();
        this._schedule_update();
    }

    _moveToCursor() {
        if (!this._widget) {
           return;
       }
        // move laser to cursor position:
        let [x, y] = global.get_pointer();
        let [width, height] = this._widget.get_size();
        this._widget.set_position(x - width / 2, y - height / 2);
    }

    hide() {
        if (this._widget) {
            this._widget.hide();
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
        if (this._widget) {
            global.stage.remove_child(this._widget);
            this._widget.destroy();
        }
    }
}
