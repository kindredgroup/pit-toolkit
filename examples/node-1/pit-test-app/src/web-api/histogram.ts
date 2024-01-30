import * as hdr from 'hdr-histogram-js';
export class Histogram{
    public summary: Map<string, any>;

    constructor(){ }

    public instantiate = ()=>{
        // can enter config to get the buckets
        hdr.build()
    }

    
}