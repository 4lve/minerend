import type JSZip from "jszip";
import { loadJson } from "./jarStore";
import { findFile } from "./jarStore";
import type { BlockModel, BlockRenderProperties, BlockTextures, Rotation } from "./types";
import * as THREE from "three";
import _ from "lodash";
import NBT from "@avensaas/nbt-parser";
import { writable } from "svelte/store";

export const blockAnimations = writable<{
    frames: number;
    interpolation: boolean;
    frameTime: number;
    texture: THREE.Texture;
}[]>([]);

function getBlockAndMod(blockId: string) {
    if (blockId.includes(":")) {
        return {
            block: blockId.split(":")[1],
            mod: blockId.split(":")[0],
        }
    }
    return {
        block: blockId,
        mod: "minecraft",
    }
}

// blockId is the block identifier, e.g. minecraft:stone
export async function loadBlockModel(blockId: string, isParent = false, properties: Record<string, string> = {}, renderProps: BlockRenderProperties = { rotation: { x: 0, y: 0, z: 0 }, uvlock: false }): Promise<[BlockModel, BlockRenderProperties] | undefined> {
    const { block, mod } = getBlockAndMod(blockId);
    console.log(block, mod);

    if (!isParent) {
        const blockStatesFile = await findFile(`assets/${mod}/blockstates/${block}.json`);
        if (blockStatesFile) {
            const blockStates = await loadJson(blockStatesFile) as Record<string, number | string>;
            if (blockStates.variants) {
                const variants = Object.entries(blockStates.variants);
                for (let [key, value] of variants) {
                    const targetProps = NBT.parseSNBT(`{${key}}`.replaceAll("=", ":")).toJSON();
                    if (value === "" || Object.entries(targetProps).every(([key, value]) => properties[key] === value)) {
                        if (Array.isArray(value)) {
                            value = value[Math.floor(Math.random() * value.length)];
                        }
                        if (value.x) {
                            renderProps.rotation.x = value.x;
                        }
                        if (value.y) {
                            renderProps.rotation.y = value.y;
                        }
                        if (value.uvlock) {
                            renderProps.uvlock = value.uvlock;
                        }
                        return loadBlockModel(value.model, true, properties, renderProps);
                    }
                }
            } else if (blockStates.multipart) {
                const multipart = Object.entries(blockStates.multipart);
                for (let [key, value] of multipart) {
                    console.log(value)
                    let apply: Record<string, string | number | boolean> = value.apply;
                    const when: Record<string, string> = value.when;
                    if (!when) continue;
                    if (Object.entries(when).every(([key, value]) => properties[key] === value)) {
                        if (apply.x) {
                            renderProps.rotation.x = apply.x as number;
                        }
                        if (apply.y) {
                            renderProps.rotation.y = apply.y as number;
                        }
                        if (apply.uvlock) {
                            renderProps.uvlock = apply.uvlock as boolean;
                        }
                        return loadBlockModel(apply.model as string, true, properties, renderProps);
                    }
                }
            }
        }
    }

    const file = await findFile(`assets/${mod}/models/${isParent ? "" : "block/"}${block}.json`);
    if (!file) {
        return;
    }

    const model: BlockModel = await loadJson(file) as BlockModel;
    let newModel: BlockModel = model;

    if (model.parent) {
        const parent = await loadBlockModel(model.parent, true, properties, renderProps);
        if (!parent) return;
        newModel = _.merge(parent[0], model);
    }

    return [newModel, renderProps];
}


export async function loadBlockTexture(blockModel: BlockModel): Promise<BlockTextures> {
    if (!blockModel.textures) {
        return {};
    }

    const textures: Record<string, string> = {};

    for (const [key, texture] of Object.entries(blockModel.textures)) {
        if (texture.startsWith("#")) {
            textures[key] = blockModel.textures[texture.replace("#", "")];
        } else {
            textures[key] = texture;
        }
    }

    return textures;
}

export async function loadBlockFileTexture(textures: BlockTextures) {
    const fileTextures: Record<string, [JSZip.JSZipObject, Record<string, any> | undefined]> = {};

    for (const [key, texture] of Object.entries(textures)) {
        const { mod, block } = getBlockAndMod(texture);
        const metadataFile = await findFile(`assets/${mod}/textures/${block}.png.mcmeta`);
        let metadata: Record<string, any> | undefined;
        if (metadataFile) {
            metadata = await loadJson(metadataFile) as Record<string, any>;
        }
        const file = await findFile(`assets/${mod}/textures/${block}.png`);
        if (file) {
            fileTextures[key] = [file, metadata];
        }
    }

    return fileTextures;
}

export async function fileToTexture(file: JSZip.JSZipObject, metadata?: Record<string, any>): Promise<THREE.Texture> {
    const image = await file.async("arraybuffer");
    const blob = new Blob([image], { type: "image/png" });
    const imageUrl = URL.createObjectURL(blob);
    const texture = new THREE.Texture(new THREE.ImageLoader().load(imageUrl));
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    if (metadata && metadata.animation) {
        const interpolate: boolean = metadata.animation.interpolate as boolean;
        const frameTime: number = metadata.animation.frameTime as number;

        await new Promise<void>((resolve) => {
            if (texture.image.complete) {
                resolve();
            } else {
                texture.image.onload = () => resolve();
            }
        });

        const frameCount = Math.floor(texture.image.height / texture.image.width);
        console.log("Frame count:", frameCount);

        // Set up UV transformation for animation
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1 / frameCount);

        texture.offset.y = 1 - (1 / frameCount) * 5;

        blockAnimations.update(animations => [...animations, {
            frames: frameCount,
            interpolation: interpolate,
            frameTime: frameTime,
            texture: texture,
        }])


    }
    return texture;
}

export async function loadColormaps() {
    const grassFile = await findFile("assets/minecraft/textures/colormap/grass.png");
    const foliageFile = await findFile("assets/minecraft/textures/colormap/foliage.png");
    if (!grassFile || !foliageFile) {
        console.error("Colormap not found");
        return;
    }

    const grassTexture = await fileToTexture(grassFile);
    const foliageTexture = await fileToTexture(foliageFile);

    return {
        grassTexture,
        foliageTexture
    }
}

export async function textureToImageData(texture: THREE.Texture): Promise<ImageData> {
    const image = await texture.image;
    // Wait for image to load before getting dimensions
    await new Promise((resolve) => {
        if (image.complete) {
            resolve(undefined);
        } else {
            image.onload = () => resolve(undefined);
        }
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Failed to create canvas context");
    }
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function getColormapColor(colormap: ImageData, temperature: number, humidity: number): number {
    const clampedTemp = Math.max(0, Math.min(1, temperature));
    const clampedHumidity = Math.max(0, Math.min(1, humidity));

    const adjustedHumidity = clampedHumidity * clampedTemp;

    const x = Math.min(Math.floor((1 - clampedTemp) * 255), 255);
    const y = Math.min(Math.floor((1 - adjustedHumidity) * 255), 255);

    const dataIndex = (y * colormap.width + x) * 4;

    const r = colormap.data[dataIndex];
    const g = colormap.data[dataIndex + 1];
    const b = colormap.data[dataIndex + 2];

    // Convert RGB values to a single hex color
    return (r << 16) | (g << 8) | b;
}