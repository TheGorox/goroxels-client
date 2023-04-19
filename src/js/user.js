const $ = require('jquery');

import {
    hexPalette,
} from './config';
import camera from './camera';
import { generateTable } from './windows';
import Window from './Window'
import globals from './globals';
import me from './me';

// import userImg from '../img/user2.png';
import userImg from '../img/user.svg'
import { ROLE } from './constants';
import { apiRequest } from './actions';
import IP from './utils/ip';
import { translate as t_ } from './translate';

import modBadge from '../img/mod-badge.svg'
import adminBadge from '../img/admin-badge.svg'
import creatorBadge from '../img/creator-badge.svg'
import { htmlspecialchars } from './utils/misc';

const usersContainer = $('#usersTable');

export default class User {
    // create user window from given object
    // tempId is a temporary id for connection
    static async CreateWindow(info, tempId) {
        const win = new Window({
            center: true,
            title: `${info.name || t_('PLAYER') + ' ' + (tempId || info.id)}`
        });

        if (info.ip) {
            if (info.cc && info.cc !== 'XX') {
                // adds a flag near the ip address
                info._ip = info.ip;

                const cc = info.cc;
                info.ip += ` [${cc}]`;
                info.ip += `<img src="${location.protocol}//www.countryflagicons.com/FLAT/16/${cc}.png" style="margin-bottom:-5px;margin-left:1px;">`;

                delete info['cc'];
            }
        }

        if (info.role !== undefined && me.role === ROLE.ADMIN && me.id !== info.id) {
            const role = info.role;
            let str = '';
            Object.keys(ROLE).forEach(text => {
                str += `<option ${(text === role) ? 'selected' : ''}>${text}</option>`
            })
            info.role = `<select type="role">${str}<select>`
        }

        let infoArr = Object.keys(info).map(key => [key, info[key]]), misc = [];
        infoArr = infoArr.filter(x => !x[0].startsWith('_')); // for shit like _ip

        if (me.role >= ROLE.MOD) {
            misc = [
                [`<input class="alertInput">`, `<button class="sendAlert">${t_('Send Alert')}</button>`],
                [`<button class="banByIp">${t_('Ban by ip')}</button>`]
            ];
        }

        let together = infoArr.concat(misc);

        $(win.body).append(generateTable(together));

        $('select[type=role]', win.body).on('change', async e => {
            const role = e.target.value,
                userId = info.id;
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
            if (body.errors) {
                body.errors.forEach(error => {
                    toastr.error(error, t_('ERROR'));
                })
            } else {
                toastr.success(t_('Changed role to') + ' ' + role);
            }
        })


        $('.sendAlert', win.body).on('click', () => {
            const val = $('.alertInput', win.body).val();

            if (val.length == 0) return;

            $('.alertInput', win.body).val('');
            globals.socket.sendAlert(tempId, val);
        });

        $('.banByIp', win.body).on('click', async () => {
            const ip = info._ip || info.ip;
            if (!ip) return toastr.error(t_('No ip!'))

            const resp = await apiRequest(`/admin/banPlayer?ip=${ip}`);
            const success = (await resp.json()).success;
            if (success)
                toastr.success(t_('Success'));
        });
    }


    constructor(name, id, userId, registered, role) {
        if (!name) name = 'ID ' + id;

        this.name = name;
        this.id = id;
        this.userId = userId;

        this.registered = registered;

        this.role = role;

        this.conns = [id];


        const safeName = htmlspecialchars(this.name);
        let displayName = globals.chat.parseColors(safeName).replace(/<[^>]*>/g, '');

        const badgeProps = this.getRoleBadgeAndTitle();

        this.element = $(
            `<tr class="tableRow">
                <td title="id ${id}" class="user">
                    ${badgeProps ? `<img src="${badgeProps.icon}" title="${badgeProps.tooltip}" class="roleBadge">` : ''}
                    <button class="userInfoBtn minrole-trusted"><img style="height: 20px" src="${userImg}"></button>
                    <span class="name">${displayName} </span>
                    <span class="xConns"></span>
                </td>
                <td></td>
            </tr>`);

        this.nameEl = $('.name', this.element);
        this.coordsEl = $(this.element.children()[1]);

        this.nameEl.on('click', function () {
            const visibleNick = this.innerText;
            globals.elements.chatInput.value += visibleNick + ', ';
            globals.elements.chatInput.focus();
        })


        $('.userInfoBtn', this.element).on('click', async () => {
            const isReg = this.registered;
            const id = isReg ? this.userId : this.id;

            const req = await fetch(`/api/userInfo?id=${id}${isReg ? '' : '&unreg=1'}`);
            const info = await req.json();
            await User.CreateWindow(info, this.id);
        });

        this.coordsEl.on('click', () => {
            const [x, y] = this.coordsEl.text()
                .slice(1, -1)
                .split(', ')
                .map(x => parseInt(x, 10));

            if (Number.isInteger(x) && Number.isInteger(y))
                camera.centerOn(x, y);
        })

        usersContainer[0].appendChild(this.element[0]);

        me.updateRoleRelatedHtml();
    }

    getRoleBadgeAndTitle() {
        if (!this.role) return null;

        let tooltip, icon;

        switch (this.role) {
            case 'MOD':
                tooltip = 'mod';
                icon = modBadge;
                break
            case 'ADMIN':
                tooltip = 'admin';
                icon = adminBadge;
                break
            default:
                return null
        }

        // if (this.userId == 1) {
        //     tooltip = 'creator';
        //     icon = creatorBadge;
        // }

        return {
            tooltip,
            icon
        }
    }

    updateCoords(color, x, y) {
        this.coordsEl.css('color', hexPalette[color]);
        this.coordsEl.text(`(${x}, ${y})`);
    }

    close(clientId) {
        this.conns.splice(this.conns.indexOf(clientId), 1);
        if (this.conns.length === 0)
            this.destroy();
        else
            this.updateX();

        delete globals.users[clientId]
    }

    destroy() {
        this.element.remove();
    }

    newConnection(clientId) {
        this.conns.push(clientId);
        this.updateX();
    }

    updateX() {
        const text = (this.conns.length > 1) ? `[x${this.conns.length}]` : '';
        $('.xConns', this.element).text(text);
    }
}