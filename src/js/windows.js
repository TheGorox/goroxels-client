import Window from './Window';
import {
    translate as tr,
    translate
} from './translate';
import me from './me';
import toastr from 'toastr';
import tools from './tools';
import globals from './globals';
import {
    keys
} from './constants';
import {
    decodeKey
} from './utils/misc';

function generateTable(arr=[]) {
    const table = $('<table class="columnTable"></table>');
    arr.forEach(([title, content]) => {
        let tableBlock = $(`
                <tr>
                    <td>${title}</td>
                    <td>${content}</td>
                </tr>`);
        table.append(tableBlock)
    });

    return table
}

function getKeyAsString(keyCode){
    return keys[keyCode] || String.fromCharCode(keyCode)
}

export function accountSettings() {
    const settingsWin = new Window({
        title: translate('account_settings'),
        center: true
    });
    if (!settingsWin.created) return;

    let html = generateTable([
        [tr('role'), me.role.toUpperCase()],
        [
            tr('change_name'),
            `<input type="text" id="name" style="width:50%"><button id="changeName">yes</button>`
        ],
        [
            tr('delete_account'),
            `<button id="changeName">yes</button>`
        ],
    ]);

    $(settingsWin.body).append(html);

    $('#name').val(me.name)
    $('#changeName').on('click', () => {
        console.log('click')
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
                // https://stackoverflow.com/questions/52153001/req-body-is-empty-express-js
                'Content-Type': 'application/json'
            }
        }).then(async r => {
            const result = await r.json();
            if (result.success) {
                toastr.success('Name successfully changed')
            } else {
                result.errors.map(e => {
                    toastr.error(e, 'Name change error')
                })
            }
        })
    })
}

export function keyBinds() {
    const keysWin = new Window({
        title: translate('toolbinds_settings'),
        center: true
    });
    if (!keysWin.created) return;

    let table = generateTable();

    for (const tool of Object.values(tools)) {
        if(!tool.key) continue;

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
                if(!tool.key) continue;

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

export function uiSettings(){
    const setWin = new Window({
        title: translate('UI Settings'),
        center: true
    });
    if(!setWin.created) return;

    const table = generateTable([
        [translate('colors size'), '<input type="range" id="colSize">'],
        [translate('palette width'), '<input type="range" id="palSize">']
    ]);

    $('#colSize').on('change', e => {
        const val = e.target.value;
    })

    $(setWin.body).append(table);
}