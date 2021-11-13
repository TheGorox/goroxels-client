// copied from template 3.0
// copyright GOROX

import jQuery from 'jquery';
import trashSVG from '../img/trash2.svg'
import closeSVG from '../img/cross.svg'

const deleteEl = document.createElement('div'); // элемент для удаления окон
deleteEl.style.cssText =
    `
    width: 80px;
    height: 80px;
    line-height: 80px;
    text-align: center;
    border: solid 2px white;
    border-radius: 50%;
    opacity: .5;
    position: absolute;
    z-index: 8;
    bottom: 10px;
    right: 10px;
    background-color: red;
    color: white;
    font-size: 68px;
    padding-left: 3px; /* костыль из-за кривой иконки мусорки */
    display: none;
    user-select: none;
    transition: all .2s ease;
    background-image: url(${trashSVG});
`;

let deleteRange = document.createElement('div');
deleteRange.style.cssText =
    `
    opacity: .1;
    width: 300px;
    height: 300px;
    position: absolute;
    border-radius: 50%;
    z-index: 7;
    bottom: -100px;
    right: -100px;
    background-color: red;
    display: none;
`

deleteEl.onpointerenter = deleteRange.onpointerenter = () => {
    deleteEl.style.opacity = '1';
};

deleteEl.onpointerleave = deleteRange.onpointerleave = () => {
    deleteEl.style.opacity = '.5';
};

// disabled due new way to close
// document.body.appendChild(deleteEl);
// document.body.appendChild(deleteRange);

let windows = [];
window.windows = windows;

export default class Window {
    static Exists(title){
        return windows.some(x => x.title === title)
    }
    static Find(title){
        return windows.find(x => x.title === title)
    }
    constructor(config) {
        // all values also will be loaded from config few lines below

        // title can be passed instead of config
        if(typeof config == 'string')
            config = {title:config}

        this.created = false;

        this.x = 0;
        this.y = 0;

        this.title = "";

        this.parent = document.body;

        // do not set to false if closeable
        this.moveable = true;
        this.closeable = true;
        this.closed = false;

        this.center = false;

        // here
        Object.assign(this, config);

        if (Window.Exists(this.title)) {
            this.oldWindow = Window.Find(this.title);
            return
        }

        this.created = true;

        if(!this.block){ // for static windows like chat
            this.block = this.createParentBlock();
            this.moveTo(this.x, this.y); // user defined coordinates
            this.parent.appendChild(this.block);
        }

        if (this.center) {
            this.moveToCenter();
            // костыль: центрирует неправильно до рендера
            setTimeout(() => this.moveToCenter());
        }

        this.addFeatures();

        windows.push(this);
    }

    createParentBlock() {
        let el = document.createElement('div');
        el.className = 'window';
        this.element = el;

        let head = document.createElement('div');
        head.className = 'windowHeader'
        head.innerHTML = '<h3>' + this.title + '</h3>';
        el.appendChild(head);

        if(this.closeable){
            const closer = document.createElement('div');
            closer.className = 'closeWindow';
            closer.innerHTML = '<div></div>';

            closer.addEventListener('pointerdown', event => {
                // prevent window moving
                event.stopPropagation();
            });
            closer.addEventListener('click', this.close.bind(this));
            head.appendChild(closer);
        }

        let body = document.createElement('div');
        body.className = 'windowBody';
        el.appendChild(body);
        this.body = body;

        return el
    }

    moveTo(x, y) {
        const rect = this.block.getBoundingClientRect();
        const w = rect.width,
            h = rect.height;

        this.x = Math.max(-w+10, x);
        this.y = Math.max(-h+10, y);

        this.x = Math.min(window.innerWidth-10, this.x);
        this.y = Math.min(window.innerHeight-10, this.y);

        this.block.style.left = this.x + 'px';
        this.block.style.top = this.y + 'px';
    }

    moveBy(x, y) {
        this.moveTo(this.x + x, this.y + y);
    }

    moveToCenter() {
        let windowWidth = window.innerWidth,
            windowHeight = window.innerHeight;

        let blockWidth = this.block.offsetWidth,
            blockHeight = this.block.offsetHeight;

        this.moveTo(
            windowWidth / 2 - blockWidth / 2,
            windowHeight / 2 - blockHeight / 2
        );
    }

    addFeatures() {
        if (this.moveable) {
            const ratio = window.devicePixelRatio||1;

            $(this.block).on('pointerdown', () => {
                let self = this;

                jQuery(document).on('pointermove', moved)

                function moved(e) {
                    e = e.originalEvent;

                    let movedX = e.movementX/ratio,
                        movedY = e.movementY/ratio;

                    self.moveBy(movedX, movedY);
                }

                if (this.closeable) {
                    deleteEl.style.display = 'block';
                    deleteRange.style.display = 'block';

                    jQuery([deleteEl, deleteRange]).one('pointerup', () => {
                        this.close();
                    })
                }

                jQuery(document).one('pointerup pointerleave', () => {
                    deleteEl.style.display = 'none';
                    deleteRange.style.display = 'none';

                    jQuery([deleteEl, deleteRange]).off('pointerup');

                    jQuery(document).off('pointermove', moved);
                });
            });

            $(this.body).on('pointerdown', e => {
                e.stopPropagation();
            })
        }

        // for window be in screen after
        // screen rotation
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.moveTo(this.x, this.y);
            }, 500);
        })
    }

    close() {
        jQuery(this.block).remove();
        this.closed = true;
        windows.splice(windows.indexOf(this), 1);
    }
}

export class DialogWindow extends Window{
    constructor(config){
        super(config);

        if(!config.buttons) return;


    }
}