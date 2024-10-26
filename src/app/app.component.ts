import {
    Component,
    HostListener,
    computed,
    inject,
    signal
} from '@angular/core';
import { UdpService } from './udp.service';

import { CommonModule } from '@angular/common';
import { ssrComponent } from './ssr/ssr.component';
import { sensorComponent } from './sensor/sensor.component';

import * as gConst from './gConst';
import * as gIF from './gIF';

const NO_SEL = 0;
const T_SENS = 1;
const RH_SENS = 2;
const AQ_SENS = 3;
const ON_OFF_ACT = 4;

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        ssrComponent,
        sensorComponent
    ],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {

    udp = inject(UdpService);

    g_const = gConst;

    items = computed(()=>{
        return this.udp.itemsMap();
    });
    desc = signal('- - -');

    constructor(){
        // ---
    }

    /***********************************************************************************************
     * fn          closeComms
     *
     * brief
     *
     */
    @HostListener('window:beforeunload')
    closeComms(){
        this.udp.udpSocket.close();
    };

    /***********************************************************************************************
     * @fn          readTemp
     *
     * @brief
     *
     */
    readTemp(){
        this.desc.set('temperature');
        this.udp.readItems(gConst.T_SENSORS);
    }

    /***********************************************************************************************
     * @fn          readRH
     *
     * @brief
     *
     */
    readRH(){
        this.desc.set('humidity');
        this.udp.readItems(gConst.RH_SENSORS);
    }

    /***********************************************************************************************
     * @fn          readAQ
     *
     * @brief
     *
     */
    readAQ(){
        this.desc.set('air quality');
        this.udp.readItems(gConst.AQ_SENSORS);
    }

    /***********************************************************************************************
     * @fn          readOnOffAct
     *
     * @brief
     *
     */
    readOnOffAct(){
        this.desc.set('on-off actuators');
        this.udp.readItems(gConst.ON_OFF_ACTUATORS);
    }

}
