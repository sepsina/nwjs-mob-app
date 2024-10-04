import { Component, Input } from '@angular/core';
import * as gIF from '../gIF';

@Component({
    selector: 'sensor',
    standalone: true,
    templateUrl: './sensor.component.html',
    styleUrls: ['./sensor.component.scss']
})
export class sensorComponent {

    @Input() sensor!: gIF.sensorItem_t;

    constructor() {
        //---
    }
}
