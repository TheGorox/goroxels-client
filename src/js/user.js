const $ = require('jquery');

import {
    hexPalette
} from './config';
import camera from './camera';

const usersContainer = $('#usersTable');

export default class User {
    constructor(name, id, registered) {
        if (!name) name = 'UNREG ID ' + id;

        this.name = name;
        this.id = id;

        this.registered = registered;

        this.element = $(
            `<tr class="tableRow">
            <td title="id ${id}" class="user">${name}</td>
            <td></td>
        </tr>`);

        // TODO redo
        this.nameEl = $(this.element.children()[0]);
        this.coordsEl = $(this.element.children()[1]);

        this.coordsEl.on('click', () => {
            const [x, y] = this.coordsEl.text()
                .slice(1, -1)
                .split(', ')
                .map(x => parseInt(x, 10));

            camera.centerOn(x, y);
        })

        usersContainer.append(this.element);
    }

    updateCoords(color, x, y) {
        this.coordsEl.css('color', hexPalette[color]);
        this.coordsEl.text(`(${x}, ${y})`);
    }

    destroy() {
        this.element.remove();
    }
}