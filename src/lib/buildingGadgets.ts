import NBT from "@avensaas/nbt-parser";
import type { Block } from "./types";


export type BuildingData = {
    name: string;
    statePosArrayList: string;
    requiredItems: {
        [key: string]: number;
    };
};

export type StatePosArrayList = {
    blockstatemap: Array<{
        Name: string;
        Properties?: {
            [key: string]: string;
        };
    }>;
    endpos: {
        X: number;
        Y: number;
        Z: number;
    };
    startpos: {
        X: number;
        Y: number;
        Z: number;
    };
    statelist: Array<number>;
};


export function deserializeStructure(data: BuildingData): Block[] {
    const nbtData = NBT.parseSNBT(data.statePosArrayList);
    const statePos = nbtData.toJSON() as StatePosArrayList;
    
    const blocks: Block[] = [];
    const { startpos, endpos, blockstatemap, statelist } = statePos;
    
    // Generate all positions between start and end (inclusive)
    for (let x = startpos.X; x <= endpos.X; x++) {
        for (let y = startpos.Y; y <= endpos.Y; y++) {
            for (let z = startpos.Z; z <= endpos.Z; z++) {
                const index = (x - startpos.X) + 
                    (y - startpos.Y) * (endpos.X - startpos.X + 1) +
                    (z - startpos.Z) * (endpos.X - startpos.X + 1) * (endpos.Y - startpos.Y + 1);
                
                const stateIndex = statelist[index];
                if (stateIndex === undefined || stateIndex < 0) continue;
                
                const blockState = blockstatemap[stateIndex];
                if (!blockState) continue;
                if (blockState.Name === "minecraft:air") continue;

                blocks.push({
                    name: blockState.Name,
                    properties: blockState.Properties || {},
                    position: [x, y, z]
                });
            }
        }
    }

    //console.log(blocks);

    return blocks;
}




