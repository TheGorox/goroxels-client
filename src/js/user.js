const $ = require('jquery');

import {
    hexPalette,
} from './config';
import camera from './camera';
import { generateTable } from './windows';
import Window from './Window'
import globals from './globals';
import me from './me';

import userImg from '../img/user2.png';
import { ROLE } from './constants';

const usersContainer = $('#usersTable');

export default class User {
    constructor(name, id, userId, registered) {
        if (!name) name = 'ID ' + id;

        this.name = name;
        this.id = id;
        this.userId = userId;

        this.registered = registered;

        this.element = $(
            `<tr class="tableRow">
                <td title="id ${id}" class="user">
                    ${this.registered ? `<button class="userInfoBtn"><img src="${userImg}"></button>` : ''}
                    <span class="name">${name}</span>
                </td>
                <td></td>
            </tr>`);

        this.nameEl = $('.name', this.element);
        this.coordsEl = $(this.element.children()[1]);

        $('.userInfoBtn', this.element).on('click', async () => {
            const win = new Window({
                center: true,
                title: `${this.name}`
            });

            const req = await fetch('/api/userInfo?id=' + this.userId, {
            });
            const info = await req.json();

            if(info.role !== undefined && me.role === ROLE.ADMIN && me.id !== info.id){
                const role = info.role;
                let str = '';
                Object.keys(ROLE).forEach(text => {
                    str += `<option ${(text === role) ? 'selected' : ''}>${text}</option>`
                })
                info.role = `<select type="role">${str}<select>`
            }
            
            // TODO: set values in specific order
            let infoArr = Object.keys(info).map(key => [key, info[key]]), misc = [];

            if(me.role >= ROLE.MOD){
                misc = [['<input class="alertInput">', '<button class="sendAlert">Send Alert</button>']];
            }

            let together = infoArr.concat(misc);

            $(win.body).append(generateTable(together));

            $('.sendAlert', win.body).on('click', () => {
                const val = $('.alertInput', win.body).val();

                if(val.length == 0 || val.length > ((me.role === ROLE.ADMIN) ? 2000 : 500)) return;

                $('.alertInput', win.body).val('');
                globals.socket.sendAlert(this.id, val);
            });

            $('select[type=role]', win.body).on('change', async e => {
                const role = e.target.value,
                    userId = this.id;
                const resp = await fetch('/api/admin/changerole', {
                    method: 'POST',
                    body: JSON.stringify({
                        id: userId,
                        role
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const body = await resp.json();
                if(body.errors){
                    body.errors.forEach(error => {
                        toastr.error(error, 'ERROR');
                    })
                }else{
                    toastr.success('Changed role to ' + role);
                }
            })
        });

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