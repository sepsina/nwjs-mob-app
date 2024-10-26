import { Injectable, signal } from '@angular/core';
import * as gConst from './gConst';
import * as gIF from './gIF';

const BRIDGE_TTL = 10;

@Injectable({
    providedIn: 'root',
})
export class UdpService {

    private dgram: any;
    public udpSocket: any;

    private bridges: gIF.bridge_t[] = [];

    seqNum = 0;

    rdCmd: gIF.rdCmd_t = {
        ip: [],
        busy: false,
        tmoRef: null,
        cmdID: 0,
        idx: 0,
        retryCnt: gConst.RD_CMD_RETRY_CNT,
    };

    itemsMap = signal(new Map());

    rxBuf = new Uint8Array(1024);
    txBuf = new Uint8Array(1024);
    rwBuf = new gIF.rwBuf_t();

    constructor() {
        this.dgram = window.nw.require('dgram');
        this.udpSocket = this.dgram.createSocket('udp4');
        this.udpSocket.on('message', (msg: any, rinfo: any)=>{
            this.udpOnMsg(msg, rinfo);
        });
        this.udpSocket.on('error', (err: any)=>{
            console.log(`server error:\n${err.stack}`);
        });
        this.udpSocket.on('listening', ()=>{
            let address = this.udpSocket.address();
            console.log(`server listening ${address.address}:${address.port}`);
        });
        this.udpSocket.bind(gConst.UDP_PORT, ()=>{
            this.udpSocket.setBroadcast(true);
        });
        this.rwBuf.wrBuf = new DataView(this.txBuf.buffer);
        setTimeout(()=>{
            this.cleanAgedBridges();
        }, 1000);
    }

    /***********************************************************************************************
     * fn          udpOnMsg
     *
     * brief
     *
     */
    udpOnMsg(msg: Uint8Array, rem: gIF.rinfo_t) {

        this.rwBuf.rdBuf = new DataView(msg.buffer);
        this.rwBuf.rdIdx = 0;

        let pktFunc = this.rwBuf.read_uint16_LE();
        switch(pktFunc) {
            case gConst.BRIDGE_ID_RSP: {
                this.addBridge(rem.address);
                break;
            }
            case gConst.ON_OFF_ACTUATORS: {
                let startIdx = this.rwBuf.read_uint16_LE();
                let numItems = this.rwBuf.read_uint16_LE();
                let doneFlag = this.rwBuf.read_uint8();
                for(let i = 0; i < numItems; i++) {
                    let item = {} as gIF.onOffItem_t;
                    item.type = gConst.ACTUATOR_ON_OFF;
                    item.partNum = this.rwBuf.read_uint32_LE();
                    item.extAddr = this.rwBuf.read_uint64_LE();
                    item.endPoint = this.rwBuf.read_uint8();
                    item.state = this.rwBuf.read_uint8();
                    item.level = this.rwBuf.read_uint8();
                    let nameLen = this.rwBuf.read_uint8();
                    let name = [];
                    for(let k = 0; k < nameLen; k++) {
                        name.push(this.rwBuf.read_uint8());
                    }
                    item.name = String.fromCharCode.apply(String, name);
                    item.ip = rem.address;
                    item.port = rem.port;

                    let key = this.itemKey(item.extAddr, item.endPoint);
                    this.itemsMap.update((map)=>{
                        map.set(key, item);
                        return new Map(map);
                    });
                }
                clearTimeout(this.rdCmd.tmoRef);
                if(doneFlag == 1) {
                    this.rdCmd.ip.shift();
                    if(this.rdCmd.ip.length > 0) {
                        this.rdCmd.idx = 0;
                        this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                        this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                        this.rdCmd.tmoRef = setTimeout(()=>{
                            this.rdCmdTmo();
                        }, gConst.RD_CMD_TMO);
                    }
                    else {
                        this.rdCmd.busy = false;
                    }
                }
                if(doneFlag == 0) {
                    this.rdCmd.idx = startIdx + numItems;
                    this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                    this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                    this.rdCmd.tmoRef = setTimeout(()=>{
                        this.rdCmdTmo();
                    }, gConst.RD_CMD_TMO);
                }
                break;
            }
            case gConst.BAT_VOLTS:
            case gConst.P_ATM_SENSORS:
            case gConst.AQ_SENSORS:
            case gConst.RH_SENSORS:
            case gConst.T_SENSORS: {
                let startIdx = this.rwBuf.read_uint16_LE();
                let numItems = this.rwBuf.read_uint16_LE();
                let doneFlag = this.rwBuf.read_uint8();
                for(let i = 0; i < numItems; i++) {
                    let item = {} as gIF.sensorItem_t;
                    item.hostIP = rem.address;
                    item.type = gConst.SENSOR;
                    item.partNum = this.rwBuf.read_uint32_LE();
                    item.extAddr = this.rwBuf.read_uint64_LE();
                    item.endPoint = this.rwBuf.read_uint8();
                    switch(pktFunc) {
                        case gConst.T_SENSORS: {
                            let val = this.rwBuf.read_uint16_LE();
                            val = val / 10.0;
                            const units = this.rwBuf.read_uint16_LE();
                            if(units == gConst.DEG_F) {
                                item.formatedVal = `${val.toFixed(1)} °F`;
                            }
                            else {
                                item.formatedVal = `${val.toFixed(1)} °C`;
                            }
                            break;
                        }
                        case gConst.RH_SENSORS: {
                            let val = this.rwBuf.read_uint16_LE();
                            val = Math.round(val / 10.0);
                            item.formatedVal = `${val.toFixed(0)} %rh`;
                            break;
                        }
                        case gConst.AQ_SENSORS: {
                            let val = this.rwBuf.read_uint16_LE();
                            item.formatedVal = `aq - ${val.toFixed(0)}`;
                            break;
                        }
                        case gConst.P_ATM_SENSORS: {
                            let val = this.rwBuf.read_uint16_LE();
                            val = val / 10.0;
                            const units = this.rwBuf.read_uint16_LE();
                            if(units == gConst.IN_HG) {
                                item.formatedVal = `${val.toFixed(1)} inHg`;
                            }
                            else {
                                val = Math.round(val);
                                item.formatedVal = `${val.toFixed(1)} mBar`;
                            }
                            break;
                        }
                        case gConst.BAT_VOLTS: {
                            let val = this.rwBuf.read_uint16_LE();
                            val = val / 10.0;
                            item.formatedVal = `${val.toFixed(1)} V`;
                            break;
                        }
                    }
                    let nameLen = this.rwBuf.read_uint8();
                    let name = [];
                    for(let k = 0; k < nameLen; k++) {
                        name.push(this.rwBuf.read_uint8());
                    }
                    item.name = String.fromCharCode.apply(String, name);

                    let key = this.itemKey(item.extAddr, item.endPoint);
                    this.itemsMap.update((map)=>{
                        map.set(key, item);
                        return new Map(map);
                    });
                }
                clearTimeout(this.rdCmd.tmoRef);
                if(doneFlag == 1) {
                    this.rdCmd.ip.shift();
                    if(this.rdCmd.ip.length > 0) {
                        this.rdCmd.idx = 0;
                        this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                        this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                        this.rdCmd.tmoRef = setTimeout(()=>{
                            this.rdCmdTmo();
                        }, gConst.RD_CMD_TMO);
                    }
                    else {
                        this.rdCmd.busy = false;
                    }
                }
                if(doneFlag == 0) {
                    this.rdCmd.idx = startIdx + numItems;
                    this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                    this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                    this.rdCmd.tmoRef = setTimeout(()=>{
                        this.rdCmdTmo();
                    }, gConst.RD_CMD_TMO);
                }
                break;
            }
            case gConst.UDP_ZCL_CMD: {
                const msgSeqNum = this.rwBuf.read_uint8();
                const extAddr = this.rwBuf.read_uint64_LE();
                const endPoint = this.rwBuf.read_uint8();
                const clusterID = this.rwBuf.read_uint16_LE();
                const status = this.rwBuf.read_uint8();
                if(msgSeqNum === this.seqNum){
                    if(clusterID === gConst.CLUSTER_ID_GEN_ON_OFF){
                        const key = this.itemKey(extAddr, endPoint);
                        const item: gIF.onOffItem_t = this.itemsMap().get(key);
                        if(item){
                            if(status === 0){
                                console.log(`cmd to ${item.name}: success`);
                            }
                            else {
                                console.log(`cmd to ${item.name}: fail`);
                            }
                        }
                    }
                }
                break;
            }
            default:
                // ---
                break;
        }
    }

    /***********************************************************************************************
     * fn          readItems
     *
     * brief
     *
     */
    public readItems(cmdID: number) {

        if(this.bridges.length == 0){
            return;
        }
        if(this.rdCmd.busy == true){
            return;
        }

        this.itemsMap.set(new Map());

        this.rdCmd.cmdID = cmdID;
        this.rdCmd.busy = true;
        this.rdCmd.ip = [];
        for(let i = 0; i < this.bridges.length; i++){
            this.rdCmd.ip.push(this.bridges[i].ip);
        }

        this.rdCmd.idx = 0;
        this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
        this.rdCmd.tmoRef = setTimeout(()=>{
            this.rdCmdTmo();
        }, gConst.RD_CMD_TMO);

        this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
    }

    /***********************************************************************************************
     * fn          getItems
     *
     * brief
     *
     */
    public getItems(ip: string, idx: number) {

        this.rwBuf.wrIdx = 0;

        this.rwBuf.write_uint16_LE(this.rdCmd.cmdID);
        this.rwBuf.write_uint16_LE(idx);

        let len = this.rwBuf.wrIdx;
        this.udpSocket.send(
            this.txBuf.slice(0, len),
            0,
            len,
            gConst.UDP_PORT,
            ip,
            (err: any)=>{
                if(err) {
                    console.log('get items err: ' + JSON.stringify(err));
                }
            }
        );
    }

    /***********************************************************************************************
     * fn          rdCmdTmo
     *
     * brief
     *
     */
    rdCmdTmo() {

        console.log('--- TMO ---');

        if(this.rdCmd.ip.length == 0) {
            this.rdCmd.busy = false;
            return;
        }
        if(this.rdCmd.retryCnt > 0) {
            this.rdCmd.retryCnt--;
            this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
            this.rdCmd.tmoRef = setTimeout(()=>{
                this.rdCmdTmo();
            }, gConst.RD_HOST_TMO);
        }
        if(this.rdCmd.retryCnt == 0) {
            this.rdCmd.ip.shift();
            if(this.rdCmd.ip.length > 0) {
                this.rdCmd.idx = 0;
                this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                this.rdCmd.tmoRef = setTimeout(()=>{
                    this.rdCmdTmo();
                }, gConst.RD_CMD_TMO);
            }
            else {
                this.rdCmd.busy = false;
            }
        }
    }

    /***********************************************************************************************
     * fn          itemKey
     *
     * brief
     *
     */
    private itemKey(extAddr: number, endPoint: number) {

        this.rwBuf.wrIdx = 0;

        this.rwBuf.write_uint64_LE(extAddr);
        this.rwBuf.write_uint8(endPoint);
        const len = this.rwBuf.wrIdx;
        let key = [];
        for (let i = 0; i < len; i++) {
            key[i] = this.txBuf[i].toString(16);
        }

        return `item-${key.join('')}`;
    }

    /***********************************************************************************************
     * fn          addBridge
     *
     * brief
     *
     */
    private addBridge(ip: string) {

        let newFlag = true;
        let i = this.bridges.length;
        if(i > 0){
            while(i--){
                if(this.bridges[i].ip == ip){
                    this.bridges[i].ttl = BRIDGE_TTL;
                    newFlag = false;
                }
            }
        }
        if(newFlag == true){
            const newBridge = {
                ip: ip,
                ttl: BRIDGE_TTL
            };
            this.bridges.push(newBridge);
        }
    }

    /***********************************************************************************************
     * fn          cleanAgedBridges
     *
     * brief
     *
     */
    private cleanAgedBridges() {

        let i = this.bridges.length;
        if(i > 0){
            while(i--){
                if(this.bridges[i].ttl > 0){
                    this.bridges[i].ttl--;
                }
                else {
                    this.bridges.splice(i, 1);
                }
            }
        }
        setTimeout(()=>{
            this.cleanAgedBridges();
        }, 1000);
    }

}
