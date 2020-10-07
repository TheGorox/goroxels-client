import globals from './globals';
const lang = globals.lang;

const languages = {
    en: {
        'tool_clicker': 'clicker',
        'tool_mover': 'mover',
        'tool_floodfill': 'floodfill',
        'template_url': 'Template link',
        'template': 'Template',
        'settings': 'Settings',
        'template_opacity': 'Template opacity',
        'account_settings': 'Account settings',
        'ui_settings': 'UI settings',
        'online': 'Online',
        'open_window': 'open',
        'toolbinds_settings': 'Tool key binds settings',

        'change_name': 'Change nickname',
        'role': 'Role',
        'delete_account': 'Delete account'
    },

    ru: {
        'tool_clicker': 'кликер',
        'tool_mover': 'перемещение',
        'tool_floodfill': 'заливка',
        'template_url': 'URL изображения',
        'template': 'Шаблон',
        'settings': 'Настройки',
        'template_opacity': 'Прозрачность шаблона',
        'account_settings': 'Настройки аккаунта',
        'ui_settings': 'Настройки UI',
        'online': 'Онлайн',
        'open_window': 'открыть',
        'toolbinds_settings': 'Настройки клавиш инструментов',
        'change_name': 'Сменить ник',
        'role': 'Роль',
        'delete_account': 'Удалить аккаунт'
    }
}

const userLanguage = languages[lang] || languages['en'];

export default {
    _(value){
        return userLanguage[value] || languages.en[value] || value
    }
}