import {
    lang
} from './globals'

const languages = {
    en: {
        'tool_clicker': 'clicker',
        'tool_mover': 'mover',
        'tool_floodfill': 'floodfill'
    },

    ru: {
        'tool_clicker': 'кликер',
        'tool_mover': 'перемещение',
        'tool_floodfill': 'заливка' 
    }
}

const userLanguage = languages[lang];

export default {
    _(value){
        return userLanguage[value] || languages.en[value] || value
    }
}