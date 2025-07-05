import St from 'gi://St';
import * as PointerWatcher from 'resource:///org/gnome/shell/ui/pointerWatcher.js';


const POINTER_POLL_RATE = 1000 / 60;


export class LaserPointer {
    constructor() {
        this._widget = new St.Widget({
            style_class: 'spotlight-laser',
            visible: false,
        });
        global.stage.add_child(this._widget);
        this._widget.connect('destroy', () => {this._widget = null});
        this._pointerWatch = null;
    }

    show() {
        if (!this._widget) {
            return;
        }
        this._pointerWatch = PointerWatcher.getPointerWatcher().addWatch(POINTER_POLL_RATE, this._updatePosition.bind(this));
        const [x, y] = global.get_pointer();
        this._updatePosition(x, y);
        this._widget.show();
    }

    _updatePosition(x, y) {
        if (!this._widget) {
           return;
       }
        // move laser to cursor position:
        let [width, height] = this._widget.get_size();
        this._widget.set_position(x - width / 2, y - height / 2);
    }

    hide() {
        if (this._widget) {
            this._widget.hide();
        }
        if (this._pointerWatch) {
            this._pointerWatch.remove();
        }
        this._pointerWatch = null;
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
