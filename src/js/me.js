import { ROLE } from './constants'

export default {
    registered: false,
    name: null,
    role: ROLE.USER,
    update(newMe){
        this.registered = newMe.registered || false;
        this.name = newMe.name || null;
        this.role = +newMe.role || ROLE.USER;

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