export type BlockFace = {
    uv?: [number, number, number, number];
    texture: string;
    cullface?: string;
    tintindex?: number;
};

export type Rotation = {
    x: number;
    y: number;
    z: number;
};

export type BlockRenderProperties = {
    rotation: Rotation;
    uvlock: boolean;
};

export type BlockTextures = Record<string, string>;

export interface BlockElement {
    from: [number, number, number];
    to: [number, number, number];
    faces: Record<string, BlockFace>;
}

export type BlockModel = {
    parent?: string;
    // can refrance other texture files and refrence other fields
    textures?: BlockTextures;
    elements?: Array<BlockElement>;
};

export type Block = {
    name: string;
    properties: Record<string, string>;
    position: [number, number, number];
};
