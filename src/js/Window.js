// copied from template 3.0
// copyright GOROX

import jQuery from 'jquery';

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
    transition: all .2s ease
`;
deleteEl.innerText = '🗑';

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

deleteEl.onmouseenter = deleteRange.onmouseenter = () => {
    deleteEl.style.opacity = '1';
};

deleteEl.onmouseleave = deleteRange.onmouseleave = () => {
    deleteEl.style.opacity = '.5';
};

document.body.appendChild(deleteEl);
document.body.appendChild(deleteRange);

let windows = [];

export default class Window {
    constructor(config) {
        this.created = false;

        this.x = 0;
        this.y = 0;

        this.title = "";

        this.parent = document.body;

        this.moveable = true;
        this.closeable = true;
        this.closed = false;

        this.center = false;

        Object.assign(this, config);

        if (windows.includes(this.title)) {
            this.closed = true;
            return
        }

        this.created = true;

        this.block = this.createParentBlock();

        this.moveTo(this.x, this.y); // user defined coordinates

        this.parent.appendChild(this.block);

        if (this.center) {
            this.moveToCenter();
        }

        this.addFeatures();

        windows.push(this.title);
    }

    createParentBlock() {
        let el = document.createElement('div');
        el.className = 'window';
        this.element = el;

        let head = document.createElement('div');
        head.className = 'windowHeader'
        head.innerHTML = '<h3>' + this.title + '</h3>';
        el.appendChild(head);

        let body = document.createElement('div');
        body.className = 'windowBody';
        el.appendChild(body);
        this.body = body;

        return el
    }

    moveTo(x, y) {
        this.x = Math.max(0, x);
        this.y = Math.max(0, y);

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
            this.block.addEventListener('mousedown', () => {
                let self = this;

                jQuery(document).on('mousemove', moved)

                function moved(e) {
                    e = e.originalEvent;

                    let movedX = e.movementX,
                        movedY = e.movementY;

                    self.moveBy(movedX, movedY);
                }

                if (this.closeable) {
                    deleteEl.style.display = 'block';
                    deleteRange.style.display = 'block';

                    jQuery([deleteEl, deleteRange]).one('mouseup', () => {
                        this.close();
                    })
                }

                jQuery(document).one('mouseup mouseleave', () => {
                    deleteEl.style.display = 'none';
                    deleteRange.style.display = 'none';

                    jQuery([deleteEl, deleteRange]).off('mouseup');

                    jQuery(document).off('mousemove', moved);
                });
            });

            this.body.addEventListener('mousedown', e => {
                e.stopPropagation();
            })
        }
    }

    close() {
        jQuery(this.block).remove();
        this.closed = true;
        windows.splice(windows.indexOf(this.title))
    }
}