import globals from './globals';
const lang = globals.lang;

const languages = {
    en: {
        'tool_clicker': 'clicker',
        'tool_mover': 'mover',
        'tool_floodfill': 'floodfill',
        'template_url': 'Template link',
        'teplate': 'Template',
        'template_opacity': 'Template opacity'
    },

    ru: {
        'tool_clicker': 'кликер',
        'tool_mover': 'перемещение',
        'tool_floodfill': 'заливка',
        'template_url': 'URL изображения',
        'teplate': 'Шаблон',
        'template_opacity': 'Прозрачность шаблона'
    }
}

const userLanguage = languages[lang];

export default {
    _(value){
        return userLanguage[value] || languages.en[value] || value
    }
}