
export interface rdCmd_t {
    ip: any;
    busy: boolean;
    tmoRef: any;
    cmdID: number;
    idx: number;
    retryCnt: number;
}

export interface sensorItem_t {
    hostIP: string;
    type: number;
    name: string;
    formatedVal: string;
    partNum: number;
    extAddr: number;
    endPoint: number;
}

export interface onOffItem_t {
    ip: string;
    port: number;
    type: number;
    name: string;
    state: number;
    level: number
    partNum: number;
    extAddr: number;
    endPoint: number;
    busy: boolean;
    tmo: any;
}

export interface rinfo_t {
    address: string;
    family: string;
    port: number;
    size: number;
}

export interface msgLogs_t {
    text: string;
    color: string;
    id: number;
}

export interface bridge_t {
    ip: string;
    ttl: number;
}

export class rwBuf_t {

    rdIdx!: number;
    wrIdx!: number;

    rdBuf!: DataView;
    wrBuf!: DataView;

    constructor(){

    }

    read_uint8(){
        const val = this.rdBuf.getUint8(this.rdIdx);
        this.rdIdx += 1;
        return val;
    }

    read_uint16_LE(){
        const val = this.rdBuf.getUint16(this.rdIdx, true);
        this.rdIdx += 2;
        return val;
    }

    read_int16_LE(){
        const val = this.rdBuf.getInt16(this.rdIdx, true);
        this.rdIdx += 2;
        return val;
    }

    read_uint32_LE(){
        const val = this.rdBuf.getUint32(this.rdIdx, true);
        this.rdIdx += 4;
        return val;
    }

    read_uint64_LE(){
        const val = this.rdBuf.getFloat64(this.rdIdx, true);
        this.rdIdx += 8;
        return val;
    }

    write_uint8(val: number){
        this.wrBuf.setUint8(this.wrIdx, val);
        this.wrIdx += 1;
    }

    modify_uint8(val: number, idx: number){
        this.wrBuf.setUint8(idx, val);
    }

    write_uint16_LE(val: number){
        this.wrBuf.setUint16(this.wrIdx, val, true);
        this.wrIdx += 2;
    }

    write_int16_LE(val: number){
        this.wrBuf.setInt16(this.wrIdx, val, true);
        this.wrIdx += 2;
    }

    modify_uint16_LE(val: number, idx: number){
        this.wrBuf.setUint16(idx, val, true);

    }

    write_uint32_LE(val: number){
        this.wrBuf.setUint32(this.wrIdx, val, true);
        this.wrIdx += 4;
    }

    write_uint64_LE(val: number){
        this.wrBuf.setFloat64(this.wrIdx, val, true);
        this.wrIdx += 8;
    }
}




