import { ROLE } from './constants'

export default {
    registered: false,
    name: null,
    id: null,
    role: ROLE.USER,
    update(newMe){
        this.registered = newMe.registered;
        if(newMe.registered){
            this.name = newMe.name;
            this.role = newMe.role;
            this.id = newMe.id;
        }

        switch(this.role){
            case ROLE.USER:
                $('.admin').hide();
                $('.mod').hide();
                break
            case ROLE.ADMIN:
                $('.admin').show();
            case ROLE.MOD:
                $('.mod').show();
        }
    }
}