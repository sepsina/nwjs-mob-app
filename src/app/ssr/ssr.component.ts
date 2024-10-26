import { Component, inject, input, signal } from '@angular/core';
import { UdpService } from '../udp.service';

import * as gConst from '../gConst';
import * as gIF from '../gIF';

const OFF = 0;
const ON = 1;
const TOGGLE = 2;

@Component({
    selector: 'ssr',
    standalone: true,
    templateUrl: './ssr.component.html',
    styleUrls: ['./ssr.component.scss']
})
export class ssrComponent {

    udp = inject(UdpService);

    onOff = input.required<gIF.onOffItem_t>();
    busyFlag = signal(false);
    tmo: any;

    rxBuf = new Uint8Array(1024);
    txBuf = new Uint8Array(1024);
    rwBuf = new gIF.rwBuf_t();

    constructor() {
        this.rwBuf.wrBuf = new DataView(this.txBuf.buffer);
    }

    /***********************************************************************************************
     * @fn          getName
     *
     * @brief
     *
     */
    getName(){
        return `${this.onOff.name}`;
    }

    /***********************************************************************************************
     * @fn          setActuatorOn
     *
     * @brief
     *
     */
    setActuatorOn(){
        this.setActuator(ON);
    }

    /***********************************************************************************************
     * @fn          setActuatorOff
     *
     * @brief
     *
     */
    setActuatorOff(){
        this.setActuator(OFF);
    }

    /***********************************************************************************************
     * @fn          toggleActuator
     *
     * @brief
     *
     */
    toggleActuator(){
        this.setActuator(TOGGLE);
    }

    /***********************************************************************************************
     * @fn          setActuator
     *
     * @brief
     *
     */
    setActuator(state: number){

        if(this.udp.rdCmd.busy == true){
            return;
        }
        this.udp.seqNum = ++this.udp.seqNum % 256;
        this.rwBuf.wrIdx = 0;;

        this.rwBuf.write_uint16_LE(gConst.UDP_ZCL_CMD);
        this.rwBuf.write_uint8(this.udp.seqNum);
        this.rwBuf.write_uint64_LE(this.onOff().extAddr);
        this.rwBuf.write_uint8(this.onOff().endPoint);
        this.rwBuf.write_uint16_LE(gConst.CLUSTER_ID_GEN_ON_OFF);
        this.rwBuf.write_uint8(0); // hasRsp -> no
        const cmdLenIdx = this.rwBuf.wrIdx;
        this.rwBuf.write_uint8(0); // cmdLen -> placeholder
        const startCmdIdx = this.rwBuf.wrIdx;
        this.rwBuf.write_uint8(0x11); // cluster spec cmd, not manu spec, client to srv dir, disable dflt rsp
        this.rwBuf.write_uint8(0); // seq num -> not used

        switch(state) {
            case OFF: {
                this.rwBuf.write_uint8(OFF);
                break;
            }
            case ON: {
                this.rwBuf.write_uint8(ON);
                break;
            }
            case TOGGLE: {
                this.rwBuf.write_uint8(TOGGLE);
                break;
            }
        }
        const msgLen = this.rwBuf.wrIdx;
        const cmdLen = msgLen - startCmdIdx;
        this.rwBuf.modify_uint8(cmdLen, cmdLenIdx); // now cmdLen gets right value

        this.udp.udpSocket.send(
            this.txBuf.slice(0, msgLen),
            0,
            msgLen,
            this.onOff().port,
            this.onOff().ip,
            (err: any)=>{
                if(err){
                    console.log('tun on err: ' + JSON.stringify(err));
            }
        });
        this.busyFlag.set(true);
        this.tmo = setTimeout(() => {
            this.busyFlag.set(false);
        }, 1000);
    }

}
