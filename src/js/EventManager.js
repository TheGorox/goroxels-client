import EventEmitter from 'events'
import globals from './globals'

export default class EventManager extends EventEmitter {
    /**
     * 
     * @param {Element} element 
     */
    constructor(element) {
        super();

        this.el = element

        this.pointers = new Map();
        this._lastDist = null;
        this._zoomed = false;

        element.addEventListener('pointerdown', e => {
            this._lastDist = null;
            if (this.pointers.size === 0) {
                this.emit('mousedown', e)
            }

            this.pointers.set(e.pointerId, e);
        });
        element.addEventListener('pointermove', e => {
            if (e.buttons !== 0 && this.pointers.size > 1) {
                let it = this.pointers.get(e.pointerId);
                if(!it) return;

                let [newX, newY] = [it.clientX, it.clientY];

                let dists = [];
                this.pointers.forEach(ev => {
                    dists.push(this.dist(ev.clientX, ev.clientY, newX, newY));
                })
                let dist = this.avrg(...dists);
                if(!this._lastDist) this._lastDist = dist;

                console.log(dists, dist, this._lastDist, dist - this._lastDist)

                this.emit('zoom', dist - this._lastDist);

                this._lastDist = dist;

                this.pointers.set(e.pointerId, e);
            } else {
                console.log('mousemode', Date.now())
                this.emit('mousemove', e);
            }
        });
        element.addEventListener('pointerup', e => {
            this._lastDist = null;
            if (!this.pointers.has(e.pointerId)) return;

            this.pointers.delete(e.pointerId);
        })
    }

    dist(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1)
    }

    avrg(...values){
        return values.reduce((a, b) => a + b) / values.length
    }
    
}