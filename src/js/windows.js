import {
    ROLE,
    keys
} from './constants';
import {
    translate as tr,
    translate
} from './translate';

import { ROLE_I } from './constants'
import Window from './Window';
import { decodeKey } from './utils/misc';
import { game } from './config'
import globals from './globals';
import me from './me';
import player from './player'
import { apiRequest, fetchCaptcha, setPaletteRows, showProtected, solveCaptcha, toggleEmojis, togglePlaced, updateBrush, updateEmojis, updateMe } from './actions';
import toastr from 'toastr';
import tools from './tools';
import chat from './chat';
import { get, getOrDefault, set } from './utils/localStorage';
import User from './user';
import { htmlspecialchars } from './utils/misc';

import userImg from '../img/user2.png';
import arrowSvg from '../img/arrow.svg'
import { capitalize } from './utils/strings';

export function generateTable(arr = []) {
    const table = $('<table class="columnTable"></table>');
    arr.forEach(([title, content]) => {
        let tableBlock = $(`
                <tr>
                    ${content === void 0 ?
                `<td colspan="2">${title}</td>` :
                `<td>${title}</td>
                        <td>${content}</td>`
            }
                </tr>`);
        table.append(tableBlock)
    });

    return table
}

function getKeyAsString(keyCode) {
    return keys[keyCode] || String.fromCharCode(keyCode)
}

export function accountSettings() {
    const settingsWin = new Window({
        title: translate('Account Settings'),
        center: true
    });
    if (!settingsWin.created) return;

    let html = generateTable([
        [tr('role'), ROLE_I[me.role].toUpperCase()],
        [
            capitalize(tr('account settings')),
            `<input type="text" id="name" style="width:50%"><button id="changeName">yes</button>`
        ],
        [
            `<button id="logout">${tr('logout')}</button>`
        ],
        // [
        //     `<button id="deleteAccount">${tr('delete_account')}</button>`
        // ]

    ]);

    $(settingsWin.body).append(html);

    $('#name').val(me.name)
    $('#changeName').on('click', () => {
        const newName = $('#name').val();

        if (!me.registered) {
            return toastr.error('Hey wtf', '0_o');
        }
        if (newName.length < 0 || newName.length > 32) {
            return toastr.error('Name length is not 0 < length < 32', 'Name change')
        }
        if (me.name === newName) {
            return toastr.error('Name is the same as was', 'Name change')
        }

        fetch('/api/changename', {
            method: 'POST',
            body: JSON.stringify({
                name: newName
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(async r => {
            const result = await r.json();
            if (!result.errors.length) {
                globals.socket.close();
                toastr.success('Name successfully changed');
                updateMe();
            } else {
                result.errors.map(e => {
                    toastr.error(e, 'Name change error')
                })
            }
        })
    })

    $('#logout').on('click', async () => {
        if (me.registered) {
            const req = await apiRequest('/auth/logout');
            const success = await req.json();
            if (success) {
                location.pathname = '/';
            } else {
                toastr.error('Can\'t log out');
            }
        }
    })
}

export function keyBinds() {
    const keysWin = new Window({
        title: capitalize(translate('toolbinds settings')),
        center: true
    });
    if (!keysWin.created) return;

    let table = generateTable();

    for (const tool of Object.values(tools)) {
        if (!tool.key) continue;

        const tableRow = $(
            `<tr>
            <td>${tool.name}</td>
            <td>
                <span id="MODS-${tool.name}"></span>
                <input id="KEY-${tool.name}" class="key" style="width:130px">
            </td>
        </tr>`);

        table.append(tableRow);

        const input = $('input', tableRow);
        const modsElement = $('span', tableRow);
        input.on('keydown', e => {
            e.preventDefault();

            //   yes          ctrl                alt
            if (!e.keyCode || e.keyCode === 17 || e.keyCode === 18) return

            const altUsed = e.altKey;
            const ctrlUsed = e.ctrlKey;

            let key = '';

            modsElement.text('');
            if (altUsed) {
                modsElement.text('ALT + ');
                key += 'ALT+'
            }
            if (ctrlUsed) {
                modsElement.text(modsElement.text() + 'CTRL + ');
                key += 'CTRL+'
            }
            key += e.keyCode;
            input.val(getKeyAsString(e.keyCode));

            // removing same values
            for (let _tool of Object.values(tools)) {
                if (tool.name != _tool.name && _tool.key == key) {
                    $('#MODS-' + _tool.name).text('')
                    $('#KEY-' + _tool.name).val('')
                }
            }

            globals.toolManager.changeKey(tool, key);
        });
        input.on('keyup', e => {
            e.preventDefault();
            if (!e.keyCode || e.keyCode === 17 || e.keyCode === 18) return

            // saving ALL key binds
            let toSave = {};

            for (const tool of Object.values(tools)) {
                if (!tool.key) continue;

                toSave[tool.name] = tool.key;
            }

            localStorage.setItem('keyBinds', JSON.stringify(toSave));
        });

        const parsed = decodeKey(tool.key);

        modsElement.text((parsed.alt ? 'ALT + ' : '') + (parsed.ctrl ? 'CTRL + ' : ''));

        input.val(getKeyAsString(parsed.keyCode));
    }

    $(keysWin.body).append(table);
}

export function uiSettings() {
    const setWin = new Window({
        title: capitalize(translate('ui settings')),
        center: true
    });
    if (!setWin.created) return;

    const table = generateTable([
        [translate('colors size'), '<input type="range" min="16", max="64" step="0.01" id="colSize><div style="width:50px;"><div>'],
        [translate('palette width'), '<input type="range" min="1", max="100" step="1" id="palSize"><div style="width:50px;"><div>'],
        [translate('hide emojis'), '<input type="checkbox" id="toggleEmojis">'],
        [translate('emoji list'), '<input type="text" id="emojiList">'],
        [`<button id="moreEmojis">${translate('super secret button')}</button>`],
        [translate('show placed pixels'), '<input type="checkbox" id="togglePlaced">']
    ]);
    $(setWin.body).append(table);

    function palSizeChanged() {
        const val = $('#palSize').val();
        setPaletteRows(val);
        localStorage.setItem('rowsRange', val);
        $('#palSize+div').text(val);
    }

    $('#colSize').on('change', e => {

    });

    $('#palSize').val(+getOrDefault('rowsRange', 100));
    $('#palSize').on('input', palSizeChanged);
    palSizeChanged();

    $('#toggleEmojis')[0].checked = get('hideEmojis') == 1;
    $('#toggleEmojis').on('click', e => {
        const state = !e.target.checked;
        set('hideEmojis', state ? 0 : 1);
        toggleEmojis(state);
    });

    $('#emojiList').val(getOrDefault('emojis', '🙁 🤔 😀 💚'));
    $('#emojiList').on('change', e => {
        set('emojis', e.target.value);
        updateEmojis(e.target.value.split(' '));
    })

    $('#moreEmojis').on('click', () => {
        const w = new Window(translate('more emojis!'));
        if (!w.created) return;

        w.body.innerHTML = '😁😂😃😄😅😆😉😊😋😌😍😏😒😓😔😖😘😚😜😝😞😠😡😢😣😤😥😨😩😪😫😭😰😱😲😳😵😷😸😹😺😻😼😽😾😿🙀🙅🙆🙇🙈🙉🙊🙋🙌🙍🙎🙏✂✅✈✉✊✋✌✏✒✔✖✨✳✴❄❇❌❎❓❔❕❗❤➕➖➗➡➰🚀🚃🚄🚅🚇🚉🚌🚏🚑🚒🚓🚕🚗🚙🚚🚢🚤🚥🚧🚨🚩🚪🚫🚬🚭🚲🚶🚹🚺🚻🚼🚽🚾🛀Ⓜ🅰🅱🅾🅿🆎🆑🆒🆓🆔🆕🆖🆗🆘🆙🆚🈁🈂🈚🈯🈲🈳🈴🈵🈶🈷🈸🈹🈺🉐🉑©®‼⁉™ℹ↔↕↖↗↘↙↩↪⌚⌛⏩⏪⏫⏬⏰⏳▪▫▶◀◻◼◽◾☀☁☎☑☔☕☝☺♈♉♊♋♌♍♎♏♐♑♒♓♠♣♥♦♨♻♿⚓⚠⚡⚪⚫⚽⚾⛄⛅⛎⛔⛪⛲⛳⛵⛺⛽⤴⤵⬅⬆⬇⬛⬜⭐⭕〰〽㊗㊙🀄🃏🌀🌁🌂🌃🌄🌅🌆🌇🌈🌉🌊🌋🌌🌏🌑🌓🌔🌕🌙🌛🌟🌠🌰🌱🌴🌵🌷🌸🌹🌺🌻🌼🌽🌾🌿🍀🍁🍂🍃🍄🍅🍆🍇🍈🍉🍊🍌🍍🍎🍏🍑🍒🍓🍔🍕🍖🍗🍘🍙🍚🍛🍜🍝🍞🍟🍠🍡🍢🍣🍤🍥🍦🍧🍨🍩🍪🍫🍬🍭🍮🍯🍰🍱🍲🍳🍴🍵🍶🍷🍸🍹🍺🍻🎀🎁🎂🎃🎄🎅🎆🎇🎈🎉🎊🎋🎌🎍🎎🎏🎐🎑🎒🎓🎠🎡🎢🎣🎤🎥🎦🎧🎨🎩🎪🎫🎬🎭🎮🎯🎰🎱🎲🎳🎴🎵🎶🎷🎸🎹🎺🎻🎼🎽🎾🎿🏀🏁🏂🏃🏄🏆🏈🏊🏠🏡🏢🏣🏥🏦🏧🏨🏩🏪🏫🏬🏭🏮🏯🏰🐌🐍🐎🐑🐒🐔🐗🐘🐙🐚🐛🐜🐝🐞🐟🐠🐡🐢🐣🐤🐥🐦🐧🐨🐩🐫🐬🐭🐮🐯🐰🐱🐲🐳🐴🐵🐶🐷🐸🐹🐺🐻🐼🐽🐾👀👂👃👄👅👆👇👈👉👊👋👌👍👎👏👐👑👒👓👔👕👖👗👘👙👚👛👜👝👞👟👠👡👢👣👤👦👧👨👩👪👫👮👯👰👱👲👳👴👵👶👷👸👹👺👻👼👽👾👿💀💁💂💃💄💅💆💇💈💉💊💋💌💍💎💏💐💑💒💓💔💕💖💗💘💙💚💛💜💝💞💟💠💡💢💣💤💥💦💧💨💩💪💫💬💮💯💰💱💲💳💴💵💸💹💺💻💼💽💾💿📀📁📂📃📄📅📆📇📈📉📊📋📌📍📎📏📐📑📒📓📔📕📖📗📘📙📚📛📜📝📞📟📠📡📢📣📤📥📦📧📨📩📪📫📮📰📱📲📳📴📶📷📹📺📻📼🔃🔊🔋🔌🔍🔎🔏🔐🔑🔒🔓🔔🔖🔗🔘🔙🔚🔛🔜🔝🔞🔟🔠🔡🔢🔣🔤🔥🔦🔧🔨🔩🔪🔫🔮🔯🔰🔱🔲🔳🔴🔵🔶🔷🔸🔹🔺🔻🔼🔽🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕛🗻🗼🗽🗾🗿😀😇😈😎😐😑😕😗😙😛😟😦😧😬😮😯😴😶🚁🚂🚆🚈🚊🚍🚎🚐🚔🚖🚘🚛🚜🚝🚞🚟🚠🚡🚣🚦🚮🚯🚰🚱🚳🚴🚵🚷🚸🚿🛁🛂🛃🛄🛅🌍🌎🌐🌒🌖🌗🌘🌚🌜🌝🌞🌲🌳🍋🍐🍼🏇🏉🏤🐀🐁🐂🐃🐄🐅🐆🐇🐈🐉🐊🐋🐏🐐🐓🐕🐖🐪👥👬👭💭💶💷📬📭📯📵🔀🔁🔂🔄🔅🔆🔇🔉🔕🔬🔭🕜🕝🕞🕟🕠🕡🕢🕣🕤🕥🕦🕧'
        w.body.style.userSelect = 'text';
    })

    $('#togglePlaced')[0].checked = getOrDefault('hidePlaced', 1) == 0;
    $('#togglePlaced').on('click', e => {
        const show = e.target.checked;
        set('hidePlaced', show ? 0 : 1);
        togglePlaced(show);
    });
}

export function gameSettings() {
    const win = new Window({
        title: capitalize(translate('game settings')),
        center: true
    });
    if (!win.created) return;

    // 1 for guests (packets disabled by server), 20 for admins, and 10 for others
    let maxBrushSize = (me.role === ROLE.ADMIN ? 20 : (me.role <= ROLE.USER ? 1 : 10))

    const table = generateTable([
        [
            translate('show protected'),
            `<input type="checkbox" id="showProtected" ${game.showProtected ? 'checked' : ''}>`
        ],
        [
            translate('brush size'),
            `<input type="checkbox" id="customBrushSize" ${player.brushSize > 1 ? 'checked' : ''}>
            <input id="brushSize" type="range" value="${player.brushSize}" ` +
            `${player.brushSize == 1 ? 'disabled' : ''} min="2" ` +
            `max="${maxBrushSize}" step="2">` +
            `<span id="brushSizeCounter">${player.brushSize - 1}<span>`
        ],
        [
            translate('max saved pixels'),
            `<input id="savePixelsInp" type="number" min="0" value="${player.maxPlaced}" style="width:4rem">`
        ],
        [
            translate('disable chat colors'),
            `<input type="checkbox" id="disableChatColors" ${chat.colorsEnabled ? '' : 'checked'}>`
        ],
        [
            translate('chat messages limit'),
            `<input type="number" id="chatLimit" value="${game.chatLimit}" title="maximum messages in chat">`
        ],
        [
            translate('light grid'),
            `<input type="checkbox" id="lightGridCB" ${tools.grid.isLight ? 'checked' : ''} title="will grid be light?">`
        ],
        [
            translate('enable grid'),
            `<input type="checkbox" id="enableGridCB" ${tools.grid.state == 1 ? 'checked' : ''}>`
        ],
    ]);

    $(win.body).append(table);

    $('#showProtected').on('change', e => {
        const show = e.target.checked;
        game.showProtected = show;
        showProtected(show);
    });

    $('#customBrushSize').on('change', e => {
        const use = e.target.checked;

        if (use) {
            // TODO thing below does not work
            $('#brushSize').removeAttr('disabled');
            updateBrush($('#brushSize').val());
        } else {
            $('#brushSize').attr('disabled');
            updateBrush(1);
        }
    });

    $('#brushSize').on('input', e => {
        updateBrush(e.target.value);
    })

    $('#savePixelsInp').on('change', e => {
        e = e.target;
        if (+e.value < 0) e.value = 0;

        player.maxPlaced = +e.value;
        localStorage.setItem('maxPlaced', player.maxPlaced)
    });

    $('#disableChatColors').on('change', e => {
        const checked = e.target.checked

        localStorage.setItem('disableColors', checked.toString());

        chat.setColors(!checked)
    })

    $('#chatLimit').on('change', e => {
        const value = parseInt(e.target.value, 10);
        if (isNaN(value) || value < 1) return;

        localStorage.setItem('chatLimit', value.toString());

        game.chatLimit = value;
    })

    $('#lightGridCB').on('change', e => {
        const checked = e.target.checked;

        localStorage.setItem('lightGrid', checked.toString());

        tools.grid.isLight = checked;
    })

    $('#enableGridCB').on('change', e => {
        const checked = e.target.checked;

        localStorage.setItem('enableGrid', checked.toString());

        if (checked) tools.grid.show();
        else tools.grid.hide();
    })
}

export async function captchaModal() {
    let win = new Window({
        title: translate('Captcha'),
        center: true,
        closeable: false
    });

    if (win.created) {
        const [help, cont, inp] = $(
            `<div>${translate('Case insensitive, 0/o i/l are same')}. <a href="#">${translate('Can\'t recognize?')}</a></div>` +
            '<div class="captchaContainer"></div>' +
            '<input class="fullWidthInput" type="text"></input>'
        );

        help.children[0].onclick = captchaModal;
        console.log(help.children[0])

        const [line] = $(`<div style="display:flex;justify-content:center">${translate('Captcha').toUpperCase()}:&nbsp;&nbsp;</div>`);
        line.appendChild(inp);

        win.body.appendChild(help)
        win.body.appendChild(cont);
        win.body.appendChild(line);

        inp.addEventListener('keydown', async e => {
            if (e.key === 'Enter') {
                if (inp.value.length == 0) return;
                let val = inp.value;
                inp.value = '';

                const success = await solveCaptcha(val);

                if (success) {
                    win.close();
                } else {
                    captchaModal();
                }
            }
        })
    } else win = win.oldWindow;

    let svg;
    try {
        svg = await fetchCaptcha();
    } catch (e) {
        console.error('error downloading captcha image: ' + e);

        globals.socket.close();
        return win.close();
    }

    // according to default dark theme
    svg = svg.replace('stroke="black"', 'stroke="white"');

    $('.captchaContainer', win.body).html(svg);

    win.moveToCenter();
    $('input', win.body).trigger('focus');
}

export function toolsWindow() {
    const toolWin = new Window({
        title: capitalize(translate('tools')),
        center: true
    });
    if (!toolWin.created) return;

    const table = generateTable([
        [`<button id="searchUsersB">${translate('search users')}</button>`]
    ]);
    $(toolWin.body).append(table);

    $('#searchUsersB', table).on('click', () => {
        const win = new Window({
            title: capitalize(translate('search users')),
            center: true
        });
        if (!win.created) return;

        const table = generateTable([
            `<input type="text" placeholder="nickname" id="userSearchText" max="32" style="width:250px"> ${translate('OR')} ` +
                '<input type="text" placeholder="id" id="userSearchId" max="32" style="width:50px">' +
                `<input type="checkbox" id="searchIsBanned"><label for="searchIsBanned">${translate('banned?')}</label>`,
            ['<div id="searchUsersBody">']
        ]);
        $(win.body).append(table);

        const input = $('#userSearchText');

        $('#userSearchId').on('input', async e => {
            let num = e.target.value.trim();
            num = +num;

            if (isNaN(num) || num < 1 || num > Number.MAX_SAFE_INTEGER) {
                return
            }

            const isBanned = $('#searchIsBanned')[0].checked;

            const searchResp = await search(null, num, isBanned);
            afterSearch(searchResp);
        })

        $('#userSearchText').on('input', async _ => {
            let text = input.val().trim();
            text = text.slice(0, 32);

            const isBanned = $('#searchIsBanned')[0].checked;

            const searchResp = await search(text, null, isBanned);
            afterSearch(searchResp);
        });

        function afterSearch(resp) {
            if (!resp || !resp.length) {
                // clean up if nothing found
                $('#searchUsersBody').html('');
                return
            };

            let table = document.createElement('table');
            table.className = 'innerTable';
            table.innerHTML += '<tr><th>NICK</th><th>ID</th><th>ROLE</th><th>&nbsp;</th></tr>'

            for (let user of resp) {
                const safeNick = htmlspecialchars(user.name);

                // little workaround with click listener,
                // this might be shorter
                const uinfoButton = document.createElement('button');
                uinfoButton.className = 'userInfoBtn';
                uinfoButton.innerHTML = `<img src="${userImg}">`;
                uinfoButton.addEventListener('click', async () => {
                    const req = await apiRequest(`/userInfo?id=${user.id}`);
                    const info = await req.json();
                    await User.CreateWindow(info);
                })

                const row = $(
                    `<tr>
                        <td>${safeNick}</td><td>${user.id}</td>` +
                    `<td>${user.role}</td>` +
                    `<td></td>
                    </tr>`
                );

                row[0].lastElementChild.appendChild(uinfoButton);
                table.appendChild(row[0]);
            }

            $('#searchUsersBody').html(table);
        }

        async function search(term, id, isBanned) {
            if (!isBanned) {
                if (!term && !id) return;
            }
            if (term && id) return;

            if (term) {
                term = encodeURIComponent(term);
            }
            const req = await apiRequest(`/admin/users/search?isBanned=${isBanned ? 1 : 0}&${id ? `id=${id}` : `t=${term}`}`)

            const json = await req.json();
            return json
        }
    });
}

function createCollapsibleBlock(title, bodyHtml, collapsed = true) {
    const head = $('<div>');
    head[0].style.cssText =
        `width: 100%;
    height: 30px;
    background-color: #5f5f5f;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    user-select: none;
    cursor: pointer`

    head.append(`<div style="font-size:20px;text-transform:uppercase;">${title}</div>`)

    const arrow = $('<div>');
    arrow[0].style.cssText =
        `position: absolute;
    top: 50%;
    transform: translate(0, -50%);
    left: 5px;
    background-image: url(${arrowSvg});
    background-size: 100%;
    background-repeat: no-repeat;
    transition: transform .2s ease-in-out;
    width: 20px;
    height: 20px;`

    head.append(arrow);

    const body = $('<div>');
    body[0].style.cssText =
        `max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s linear;
    font-size: 17px`
    body.html(bodyHtml);

    const headBodyContainer = $('<div>');
    headBodyContainer[0].style.cssText =
        `margin-bottom: 1px;`
    headBodyContainer.append(head, body)

    let state = 0; // 0 - closed, 1 - opened
    function toggle() {
        if (state) {
            arrow.css('transform', 'translate(0px, -50%) rotate(0deg)');
            body.css('max-height', 0);
        } else {
            arrow.css('transform', 'translate(0px, -50%) rotate(180deg)');
            body.css('max-height', $(body)[0].scrollHeight);
        }

        // becomes true/false analog
        state = !state;
    }
    if (!collapsed) setTimeout(toggle);

    head.on('click', toggle);

    return headBodyContainer
}

export function help() {
    const helpWin = new Window({
        title: translate('help'),
        center: true
    });
    if (!helpWin.created) return;

    helpWin.body.style.width = '90vw'
    helpWin.body.style.height = '90vh'
    helpWin.body.style.fontSize = '15px';

    // TODO move this to translations
    const intro = createCollapsibleBlock(translate('Вступление'), 
    `${translate('Goroxels - это мультиплеерная пиксельная рисовалка почти без задержки!')}<br>
    ${translate('Добавлены различные инструменты и фичи для упрощения рисования.')}<br>
    ${translate('На главном полотне может рисовать каждый, но зарегистрированным пользователям даются преимущества в виде чата, уменьшенной задержки между пикселями и не только.')}`, false);

    const howto = createCollapsibleBlock(translate('Как играть?'), 
    `${translate('Очень просто: как и в любой рисовалке, выбираешь цвет в палитре(кликом по нему или с помощью специального инструмента Пипетка), и кликаешь по полотну чтобы поставить пиксель.')}<br>
    ${translate('Можно рисовать сразу много пикселей, но как это сделать будет рассказано в разделе инструментов.')}`);

    const tools = createCollapsibleBlock(translate('Инструменты'), 
    `${translate('Для упрощения игрового процесса было добавлено множество инструментов, вот несколько из них:')}<br><br>
    ${translate('Кликер. Для того, чтобы рисовать кликером, зажми пробел(клавиши всех инструментов можно поменять) в месте где хочешь начать рисовать, и води как кисточкой по полотну.')}<br>
    ${translate('Со временем кликер перестанет рисовать непрерывно - из-за введённой в игру задержки рисования. Она нужна чтобы минимизировать ущерб от ботов и вандалов.')}<br>
    ${translate('У зарегистрированных пользователей, а также повышенных до Доверенного задержка значительно меньше.')}<br>
    ${translate('Быстро переключать цвета можно с помощью [A] (пред. цвет) и [S] (след. цвет).')}<br>
    ${translate('Также цвет можно подобрать с полотна клавишей [C].')}<br>
    ${translate('Также можно контролировать размер кисти (недоступно Гостям) с помощью квадратных скобок, как в Photoshop.')}<br>
    ${translate('Для рисования ровных линий был добавлен инстумент Линия [Shift].')}<br>
    ${translate('А также если нужно залить цветом определённую область - существует инструмент Заливка [F]. Зажатие покажет превью заливки, чтобы проверить, не будет ли утечек, а отпускание клавиши начнёт заливку.')}<br>
    ${translate('Если нужно быстро сбросить цвет(а), нажми правой кнопкой мыши на полотне.')}<br>
    ${translate('Включить сетку пикселей можно на клавишу [G].')}<br>
    ${translate('На [Z] (по желанию можно поменять на Ctrl+Z) можно отменить случайно поставленный пиксель. Если зажать, то много сразу (лимит сохранённых пикселей изменяется в Настройках Игры)')}<br>`);

    const tools2 = createCollapsibleBlock(translate('Остальные инструменты'), 
    `${translate('Для продвинутых пользователей добавлена поддержка мультицвета - это когда кисть рисует сразу двумя цветами, чередуя их.')}<br>
    ${translate('Подобрать второй цвет можно с помощью [Alt+C]. Если случайно перепутал порядок цветов - не беда: нажми [X], и цвета поменяются местами.')}<br>
    ${translate('Также есть возможность скрыть верхнее меню [L], чат [K], и даже весь UI сразу: [;].')}<br>
    ${translate('Можно вставить картинку через [Ctrl+V] (только для зарегистрированных); вероятно, поддержка этого инструмента будет ограничена до Модератора.')}<br>
    ${translate('Клавиша [U] добавляет координаты под курсором в поле ввода чата. Координаты в чате кликабельны(по клику можно перейти на место)')}<br>
    ${translate('Для управления шаблоном введены инструменты переключения прозрачности с 0 до N(установленная в настройках шаблона прозрачность) [O] или с 1 до N [P].')}<br>
    ${translate('Остальные инструменты либо тестовые, либо доступны только Модераторам.')}`);

    const template = createCollapsibleBlock(translate('Шаблон'), 
    `${translate('Для рисования по шаблону специально была добавлена поддержка наложений. Чтобы изображение появилось поверх полотна, нужно ввести ссылку на него в "URL изображения" колонки ШАБЛОН.')}<br>
    ${translate('Чтобы не возникло проблем с загрузкой, желательно предварительно залить картинку на специальный хостинг, например <a href="//imgur.com">imgur.com</a>.')}<br>
    ${translate('Изменять координаты можно вручную (X и Y поля в ШАБЛОНе), либо перетаскивая изображение прямо на полотне, зажав Ctrl.')}<br>
    ${translate('Для упрощения рисования по шаблону также сделан <a href="/convert">Конвертер</a>. В нём две основные функции: конвертация в палитру и конвертация в узор.')}<br>
    ${translate('Рекомендованный порядок действий: сначала сконвертировать в палитру (можно вставлять ссылки, открывать из файла, либо из буфера обмена), затем скопировать готовую картинку и вставить в узорный конвертер. Когда шаблон будет готов, нажми "загрузить на imgur" и скопируй полученную ссылку в "URL изображения". Увидишь, с ним куда проще.')}<br>
    ${translate('Если ссылка красная, значит изображение слишком большое. Попробуй рисовать по частям.')}`);


    $(helpWin.body).append(intro, howto, tools, tools2, template);
}